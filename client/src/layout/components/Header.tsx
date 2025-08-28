import { memo, useEffect, useState } from 'react';
import search from '../../shared/assets/header/search.svg';
import moon from '../../shared/assets/header/moon.svg';
import sun from '../../shared/assets/header/sun.svg';
import { useNavigate } from 'react-router-dom';

const Header = () => {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  const navigate = useNavigate()
  return (
    <div className="w-full h-16 px-6 flex justify-between items-center">
      <label htmlFor="search" className='flex gap-4'>
        <div>
          <img src={search} alt="" />
        </div>
        <input className='outline-none' type="text" id="search" placeholder='Search' />
      </label>
      <div className='flex gap-4'>
        <button onClick={() => setDark(!dark)}>{dark ? <div><img className='' src={sun} alt="" /></div> : <div><img className='bg-white' src={moon} alt="" /></div>}</button>
        <button onClick={() => navigate('/profile')}>Profile</button>
      </div>
    </div>
  );
};

export default memo(Header);