import { memo, useState } from 'react';
import { Image, Spin } from 'antd';
import Avatar from '../../../shared/assets/profile-image/Avatar.png';
import Vector from '../../../shared/assets/profile-image/Vector.svg';
import Star from '../../../shared/assets/profile-image/star.svg';
import { useProfile } from '../../../shared/api/hooks/useProfile';
import EditProfileModal from '../ui/Popap';
import { setEditing } from '../../../shared/lib/features/profile/profileEditSlice';
import { useDispatch } from 'react-redux';

const Overview = () => {
  const dispatch = useDispatch();
  const { getUser } = useProfile();
  const { data, isLoading, refetch } = getUser();
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" tip="Loading profile..." fullscreen />
      </div>
    );
  }

  const user = data?.data;
  console.log(user);
  return (
    <div className="flex justify-center min-h-screen px-4 md:px-8 lg:px-16">
      <div className="flex flex-col w-full max-w-[900px]">
        <div className="flex justify-center">
          <div className="w-full md:w-[400px] lg:w-[450px] mt-8 p-4 flex flex-col items-center justify-between bg-white dark:bg-[#1e1e2d] rounded-xl shadow-md">
            <div className="flex flex-col items-center">
              <Image
                src={user?.avatar || Avatar}
                alt="avatar"
                className="rounded-full w-[100px] h-[100px] object-cover"
                preview={false}
              />
              <h2 className="mt-3 text-lg md:text-xl font-semibold">
                {user?.first_name}
              </h2>
              <h2
                className={`mt-3 px-3 py-1 text-sm md:text-[15px] rounded-2xl 
                  ${
                    user?.status === 'active'
                      ? 'bg-green-500/20 text-green-600'
                      : 'bg-red-500/17 text-[#FF4C51]'
                  }`}
              >
                {user?.status}
              </h2>
            </div>

            <div className="flex justify-between items-center w-full mt-6 gap-6">
              <div className="flex justify-center items-center gap-3">
                <div className="size-[40px] bg-[#f4f5fa] dark:bg-[#8C57FF29] flex justify-center items-center rounded-[6px]">
                  <img src={Vector} alt="" />
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-semibold">1.23k</h2>
                  <h2 className="text-[#686666] text-sm">Task Done</h2>
                </div>
              </div>

              <div className="flex justify-center items-center gap-3">
                <div className="size-[40px] bg-[#f4f5fa] dark:bg-[#8C57FF29] flex justify-center items-center rounded-[6px]">
                  <img src={Star} alt="" />
                </div>
                <div>
                  <h2 className="text-base md:text-lg font-semibold">587</h2>
                  <h2 className="text-[#686666] text-sm">Task Done</h2>
                </div>
              </div>
            </div>
          </div>
        </div>

        {user && (
          <div className="px-3 md:px-6 mt-6">
            <h2 className="text-lg font-semibold">Details</h2>
            <div className="w-full border border-[#2E263D1F] my-3"></div>

            <div className="grid md:grid-cols-2 gap-4">
              {user.first_name && (
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    First Name
                  </span>
                  <span className="bg-gray-100 dark:bg-[#2A2A3C] px-3 py-1 rounded-md text-[#2E263DB2] dark:text-[#EAEAEA]">
                    {user.first_name}
                  </span>
                </div>
              )}

              {user.last_name && (
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Last Name
                  </span>
                  <span className="bg-gray-100 dark:bg-[#2A2A3C] px-3 py-1 rounded-md text-[#2E263DB2] dark:text-[#EAEAEA]">
                    {user.last_name}
                  </span>
                </div>
              )}

              {user.region_id && (
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Region
                  </span>
                  <span className="bg-gray-100 dark:bg-[#2A2A3C] px-3 py-1 rounded-md text-[#2E263DB2] dark:text-[#EAEAEA]">
                    {user.region_id}
                  </span>
                </div>
              )}

              {user.tariff_center && (
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Tariff Center
                  </span>
                  <span className="bg-gray-100 dark:bg-[#2A2A3C] px-3 py-1 rounded-md text-[#2E263DB2] dark:text-[#EAEAEA]">
                    {user.tariff_center}
                  </span>
                </div>
              )}

              {user.tariff_home && (
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Tariff Home
                  </span>
                  <span className="bg-gray-100 dark:bg-[#2A2A3C] px-3 py-1 rounded-md text-[#2E263DB2] dark:text-[#EAEAEA]">
                    {user.tariff_home}
                  </span>
                </div>
              )}

              {user.role && (
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Role
                  </span>
                  <span className="bg-gray-100 dark:bg-[#2A2A3C] px-3 py-1 rounded-md text-[#2E263DB2] dark:text-[#EAEAEA]">
                    {user.role}
                  </span>
                </div>
              )}

              {user.phone_number && (
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Contact
                  </span>
                  <span className="bg-gray-100 dark:bg-[#2A2A3C] px-3 py-1 rounded-md text-[#2E263DB2] dark:text-[#EAEAEA]">
                    {user.phone_number}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-center items-center mt-6">
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => {
                setOpen(true);
                dispatch(
                  setEditing({
                    phone_number: user?.phone_number,
                  }),
                );
              }}
              className="hover:bg-[#9b72f5] border-none bg-[#8C57FF]  px-4 h-[38px] w-[100px] rounded-[6px] text-white"
            >
              Edit
            </button>
          </div>
        </div>

        {user && (
          <EditProfileModal
            open={open}
            onClose={() => setOpen(false)}
            user={user}
            refetch={refetch}
          />
        )}
      </div>
    </div>
  );
};

export default memo(Overview);
