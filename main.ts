import {
  build,
  Plugin,
  stop,
} from 'https://deno.land/x/esbuild@v0.15.10/mod.js';
import { denoPlugin } from 'https://deno.land/x/esbuild_deno_loader@0.5.2/mod.ts';
import { serve } from 'https://deno.land/std@0.159.0/http/mod.ts';
import {
  serveDir,
  serveFile,
} from 'https://deno.land/std@0.159.0/http/file_server.ts';

const readFile = async (fileName: string): Promise<string> => {
  const decoder = new TextDecoder();
  const bytes = await Deno.readFile(fileName);
  return decoder.decode(bytes);
};

const writeFile = async (fileName: string, text: string): Promise<void> => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  return await Deno.writeFile(fileName, bytes);
};

// Plugin to delete dist/assets on build
const clean = (): Plugin => {
  return {
    name: 'esbuild:clean',
    setup({ onStart }) {
      onStart(async () => {
        try {
          await Deno.remove('dist/assets', { recursive: true });
        } catch (_ex: unknown) {
          // dist/assets doesn't exist
        }
      });
    },
  };
};

const clients: WebSocket[] = [];

const main = async (dev: boolean) => {
  // Inject scripts into index.html
  let indexSrc = await readFile('./index.html');

  indexSrc = indexSrc.replace(
    '</body>',
    '<script src="/assets/main.js" type="module"></script>' +
      '</body>',
  );

  if (dev) {
    indexSrc = indexSrc.replace(
      '</body>',
      '<script type="module">' +
        'new WebSocket(`ws://${location.host}/__ws`).addEventListener("message", () => location.reload());' +
        '</script></body>',
    );
  }

  await writeFile('./dist/index.html', indexSrc);

  // Build app with esbuild
  await build({
    plugins: [
      denoPlugin({
        importMapURL: new URL(`file:///${Deno.cwd()}/import_map.json`),
        loader: 'native',
      }),
      clean(),
    ],
    entryPoints: ['react', './main.tsx', './App.tsx'],
    splitting: true,
    chunkNames: 'chunks/[name]-[hash]',
    outdir: '../dist/assets',
    legalComments: 'inline',
    minify: true,
    bundle: true,
    format: 'esm',
    jsx: 'transform',
    absWorkingDir: Deno.cwd().replaceAll('\\', '/') + '/src',
    watch: !dev ? false : {
      onRebuild(err) {
        clients.forEach((ws) => ws.send('update'));
        clients.length = 0;

        console.clear();
        if (err) {
          console.error(err);
        } else {
          console.log('rebuilt successfully');
        }
      },
    },
  });

  // Start dev server
  if (dev) {
    console.clear();
    serve((req) => {
      if (req.url.endsWith('/__ws')) {
        const { socket, response } = Deno.upgradeWebSocket(req);
        clients.push(socket);
        return response;
      }

      try {
        return serveDir(req, { fsRoot: 'dist', quiet: true });
      } catch (_ex) {
        return serveFile(req, `dist/index.html`);
      }
    }, { port: 5862 });
  } else {
    stop();
    Deno.exit(0);
  }
};

const isDev = Deno.args.at(0) === 'true';
await main(isDev);
