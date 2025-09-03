import { memo } from 'react';
import { Image } from 'antd';
import Avatar from '../../../shared/assets/profile-image/Avatar.png';
import Vector from '../../../shared/assets/profile-image/Vector.svg';
import Star from '../../../shared/assets/profile-image/star.svg';

const Overview = () => {
  return (
    <div className="flex justify-center h-screen">
      <div className="flex flex-col w-full">
        <div className="flex justify-center">
          <div className="w-[303px] mt-[48px] h-[278px] flex flex-col items-center justify-between">
            <div>
              <div>
                <Image src={Avatar} alt="" />
              </div>
              <div>
                <h2 className="ml-[5px] text-xl">Seth Hallam</h2>
                <h2 className="ml-3 mt-[16px] bg-red-500/17 w-[74px] text-[15px] h-[24px] text-[#FF4C51] text-center rounded-2xl">
                  Blocked
                </h2>
              </div>
            </div>

            <div className="flex justify-between items-center w-full">
              <div className="flex justify-center items-center gap-4 ">
                <div className="size-[40px] bg-[#f4f5fa] dark:bg-[#8C57FF29] flex justify-center items-center rounded-[6px]">
                  <img src={Vector} alt="" />
                </div>
                <div>
                  <h2 className="text-[18px]">1.23k</h2>
                  <h2 className="text-[#686666]">Task Done</h2>
                </div>
              </div>

              <div className="flex justify-center items-center gap-4">
                <div className="size-[40px] bg-[#f4f5fa] dark:bg-[#8C57FF29] flex justify-center items-center rounded-[6px]">
                  <img src={Star} alt="" />
                </div>
                <div>
                  <h2 className="text-[18px]">587</h2>
                  <h2 className="text-[#686666]">Task Done</h2>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 mt-[24px]">
          <h2>Details</h2>
          <div className="w-full border border-[#2E263D1F] my-4"></div>

          <div>
            <h2>
              Username: <span className="text-[#2E263DB2] dark:text-[#979191]">@shallamb</span>{' '}
            </h2>
            <h2 className="mt-[8px]">
              Billing Email:{' '}
              <span className="text-[#2E263DB2] dark:text-[#979191]">shallamb@gmail.com</span>{' '}
            </h2>
            <h2 className="mt-[8px]">
              Status:{' '}
              <span className="text-[#2E263DB2] dark:text-[#979191]">shallamb@gmail.com</span>{' '}
            </h2>
            <h2 className="mt-[8px]">
              Role: <span className="text-[#2E263DB2] dark:text-[#979191]">Subscriber</span>{' '}
            </h2>
            <h2 className="mt-[8px]">
              Tax ID: <span className="text-[#2E263DB2] dark:text-[#979191]">Tax-8894</span>{' '}
            </h2>
            <h2 className="mt-[8px]">
              Contact:{' '}
              <span className="text-[#2E263DB2] dark:text-[#979191]"> +1 (234) 464-0600</span>{' '}
            </h2>
            <h2 className="mt-[8px]">
              Language: <span className="text-[#2E263DB2] dark:text-[#979191]">English</span>{' '}
            </h2>
            <h2 className="mt-[8px]">
              Country:  <span className="text-[#2E263DB2] dark:text-[#979191]"> Peru</span>{' '}
            </h2>
          </div>
        </div>

        <div className="flex justify-center items-center mt-[24px]">
          <div className=" flex justify-center items-center gap-[16px] ">
            <div>
              <button className=" hover:bg-[#9b72f5]  border-none bg-[#8C57FF] w-[64px] h-[38px] rounded-[6px]">
                Edit
              </button>
            </div>
            <div>
              <button className="border border-[#56CA00] hover:border-[#d1ffad] w-[120px] h-[38px] rounded-[6px] text-[#56CA00]">
                Activate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(Overview);
