import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom';

const selectRole = () => {

  const navigate = useNavigate();

  const handleRole = (role: string) => {
   navigate("/login", { state: { role } });
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white shadow-lg rounded-2xl p-10 flex flex-col gap-6 w-80 text-center">
        <h1 className="text-2xl font-bold text-gray-800">
          Kirish turini tanlang
        </h1>
        <button
          onClick={() => handleRole("user")}

          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition"
        >
          Users bilan kirish
        </button>
        <button
          onClick={() => handleRole("market")}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition"
        >
          Markets bilan kirish
        </button>
      </div>
    </div>
  );
}

export default React.memo(selectRole);