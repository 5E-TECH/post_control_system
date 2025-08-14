import React, { Suspense } from "react"
import { useRoutes } from "react-router-dom"
import { Auth, Dashboard, Login } from "../pages";



const MainRoutes = () => {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            {
                useRoutes(
                    [
                        { path: '/login', element: <Login /> },
                        {
                            path: '/', element: <Auth />, children: [
                                { path: 'dashboard', element: <Dashboard /> }
                            ]
                        }
                    ]
                )
            }
        </Suspense>
    )
}

export default React.memo(MainRoutes);