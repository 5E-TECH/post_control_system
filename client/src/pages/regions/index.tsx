import React from 'react'
import UzbekistanMap from './components/map'

const Regions = () => {
    return (
        <div>Regions
            <UzbekistanMap/>
        </div>
    )
}

export default React.memo(Regions)