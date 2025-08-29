import { memo } from 'react';
import ProfilCard1 from '../../shared/components/profil-view-card-1/profil-card-1';

const Profil = () => {
  return (
    <div className="Index">
      <div>
        <div className="border w-[343px] h-[724px]"></div>
        <ProfilCard1 />
        <div className="border w-[343px] h-[345px]"></div>
      </div>
    </div>
  );
};

export default memo(Profil);
