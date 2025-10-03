import React from 'react'
import UzbekistanMap from './components/map'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

const Regions = () => {
    const navigate = useNavigate()
    const {pathname} = useLocation()
    if(pathname.startsWith("/regions/")){
        return <Outlet/>
    }
    return (
        <div>Regions
            <UzbekistanMap/>
            <button onClick={() => navigate("districts")}>
                Districni tartiblash
            </button>
        </div>
    )
}

export default React.memo(Regions)