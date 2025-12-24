import { memo, type FC } from 'react';

interface RegionMapProps {
  regionName: string | null; // masalan "Namangan"
}

const RegionMap:FC<RegionMapProps> = ({regionName}) => {
  return (
    <div>
      <h2>RegionMap</h2>
    </div>
  );
};

export default memo(RegionMap);
