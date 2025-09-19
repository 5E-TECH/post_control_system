import { memo } from 'react';

const Search = () => {
  return (
    <div className="flex justify-between w-full items-center p-10">
        <h2 className='text-[20px] font-medium text-[#2E263DE5] dark:text-[#E7E3FCE5]'>Today Orders</h2>
      <form action="">
        <div className='border border-[#d1cfd4] rounded-md'>
            <input className='outline-none px-4 py-3' type="text" placeholder='Search'/>
        </div>
      </form>
    </div>
  );
};

export default memo(Search);