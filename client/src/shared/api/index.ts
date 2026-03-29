import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { BASE_URL } from "../const";

export const api = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
    paramsSerializer: {
        indexes: null  // Creates ?status=paid&status=sold instead of status[0]=paid
    }
})

// Track refresh state to prevent multiple simultaneous refresh requests
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (token) {
            resolve(token);
        } else {
            reject(error);
        }
    });
    failedQueue = [];
};

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("x-auth-token")

    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        const status = error.response?.status;

        // Only attempt refresh for 401 errors on non-refresh, non-signin requests
        if (
            status === 401 &&
            originalRequest &&
            !originalRequest._retry &&
            !originalRequest.url?.includes('user/refresh') &&
            !originalRequest.url?.includes('user/signin')
        ) {
            if (isRefreshing) {
                // If already refreshing, queue this request
                return new Promise<string>((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const response = await axios.post(
                    `${BASE_URL}user/refresh`,
                    {},
                    { withCredentials: true }
                );

                const newToken = response.data?.data?.access_token;
                if (!newToken) {
                    throw new Error('No access token in refresh response');
                }

                localStorage.setItem("x-auth-token", newToken);
                originalRequest.headers.Authorization = `Bearer ${newToken}`;

                processQueue(null, newToken);
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                localStorage.removeItem("x-auth-token");
                localStorage.removeItem("refresh_token_expires_at");
                window.location.href = "/login";
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        // For non-401 errors or already retried requests, reject normally
        if (status === 401) {
            localStorage.removeItem("x-auth-token");
            localStorage.removeItem("refresh_token_expires_at");
            window.location.href = "/login";
        }

        return Promise.reject(error);
    }
);
