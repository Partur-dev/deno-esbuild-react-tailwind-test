import React, { useState } from 'react';

export const App = () => {
  const [count, setCount] = useState(0);

  const handleClick = () => setCount((count) => count + 1);

  return (
    <div className='w-screen h-screen bg-gray-900 text-white flex flex-col items-center justify-center'>
      <span className='text-lg'>Count: {count}</span>
      <button
        className='px-4 py-2 bg-sky-600 font-semibold rounded-md mt-2'
        onClick={handleClick}
      >
        Add
      </button>
    </div>
  );
};
