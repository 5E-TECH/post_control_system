import React from 'react'
import UzbekistanMap from './components/map'
import { useNavigate } from 'react-router-dom'

const Regions = () => {
    const navigate = useNavigate()
    return (
        <div>Regions
            <UzbekistanMap/>
            <button onClick={() => navigate("region-districts")}>
                Districni tartiblash
            </button>
        </div>
    )
}

export default React.memo(Regions)