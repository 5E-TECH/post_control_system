import { lazy } from 'react'

const Login = lazy(() => import('../pages/login'))

const Auth = lazy(() => import('../pages/auth'))
const Dashboard = lazy(() => import('../pages/dashboard'))

export { Login, Auth, Dashboard }