import { useEffect, useState, useCallback, memo } from "react";
import { Modal } from "antd";
import { LogoutOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { api } from "../../api";
import { buildAdminPath } from "../../const";

const WARNING_THRESHOLD_MS = 15 * 60 * 1000; // 15 daqiqa
const CRITICAL_THRESHOLD_MS = 5 * 60 * 1000; // 5 daqiqa - qizil pulsatsiya
const CHECK_INTERVAL_MS = 30 * 1000;

const formatTime = (ms: number): string => {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

/**
 * Header ichida timer ko'rsatadi.
 * - 15 daqiqa qolganda: timer + modal ogohlantirish
 * - Modal yopilsa ham timer yuqorida qoladi
 * - 5 daqiqa qolganda: qizil pulsatsiya effekti
 * - 0 ga yetganda: avtomatik logout
 */
const SessionTimer = () => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [modalShown, setModalShown] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleLogout = useCallback(async () => {
    try {
      await api.post("user/signout");
    } catch {
      // Ignore errors during logout
    } finally {
      localStorage.removeItem("x-auth-token");
      localStorage.removeItem("refresh_token_expires_at");
      window.location.href = buildAdminPath("login", { absolute: true });
    }
  }, []);

  useEffect(() => {
    const checkExpiry = () => {
      const expiresAt = localStorage.getItem("refresh_token_expires_at");
      if (!expiresAt) return;

      const remaining = Number(expiresAt) - Date.now();

      if (remaining <= 0) {
        handleLogout();
        return;
      }

      if (remaining <= WARNING_THRESHOLD_MS) {
        setShowWarning(true);
        setTimeLeft(remaining);

        // Faqat birinchi marta modal ko'rsat
        if (!modalShown) {
          setShowModal(true);
          setModalShown(true);
        }
      } else {
        setShowWarning(false);
        setTimeLeft(null);
      }
    };

    checkExpiry();
    const intervalId = setInterval(checkExpiry, CHECK_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [handleLogout, modalShown]);

  // Countdown - har sekundda
  useEffect(() => {
    if (!showWarning || timeLeft === null) return;

    const countdownId = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1000) {
          handleLogout();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(countdownId);
  }, [showWarning, handleLogout]);

  if (!showWarning || timeLeft === null) return null;

  const isCritical = timeLeft <= CRITICAL_THRESHOLD_MS;

  return (
    <>
      {/* Header inline timer */}
      <div
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl cursor-default select-none border transition-all duration-300 ${
          isCritical
            ? "bg-red-700/20 border-red-700/40 text-red-700 dark:bg-red-800/30 dark:border-red-600/50 dark:text-red-400"
            : "bg-orange-600/15 border-orange-500/30 text-orange-700 dark:bg-orange-700/20 dark:border-orange-500/40 dark:text-orange-400"
        }`}
      >
        <ClockCircleOutlined
          style={{ fontSize: 18 }}
        />
        <span
          className="font-mono font-extrabold tabular-nums tracking-wide"
          style={{
            fontSize: isCritical ? 20 : 16,
            animation: isCritical ? "session-pulse 1s ease-in-out infinite" : "none",
          }}
        >
          {formatTime(timeLeft)}
        </span>
      </div>

      {/* Pulse animatsiya */}
      <style>{`
        @keyframes session-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: 0.8; }
        }
      `}</style>

      {/* Ogohlantirish modali - faqat birinchi marta, tashqariga bosganda yopiladi */}
      <Modal
        open={showModal}
        closable={true}
        onCancel={() => setShowModal(false)}
        footer={null}
        centered
        maskClosable={true}
        width={400}
      >
        <div className="text-center py-4">
          <ClockCircleOutlined
            className="text-orange-500 mb-4"
            style={{ fontSize: 48 }}
          />
          <h3 className="text-lg font-semibold mb-2">
            Sessiya tugashiga oz vaqt qoldi!
          </h3>
          <p className="text-gray-500 mb-4">
            Sessiyangiz avtomatik tugatiladi. Ishingizni tugatib olishingiz
            mumkin — timer yuqorida ko'rinib turadi.
          </p>
          <div
            className="text-4xl font-mono font-bold mb-6"
            style={{ color: isCritical ? "#ef4444" : "#f97316" }}
          >
            {formatTime(timeLeft)}
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setShowModal(false)}
              className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-6 py-2 rounded-lg cursor-pointer transition-colors"
            >
              Davom etish
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
            >
              <LogoutOutlined />
              Chiqish
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default memo(SessionTimer);
