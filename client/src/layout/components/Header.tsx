import { memo } from 'react';
import { NavLink } from 'react-router-dom';

const Header = () => {
  return (
    <div className="Header">
      <h2>Header</h2>
      <NavLink to={"/"}>Home</NavLink>
      <NavLink to={"/movie"}>Movie</NavLink>
    </div>
  );
};

export default memo(Header);