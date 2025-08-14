import React from 'react'
import { useUser } from '../../api/hooks/useUser'

const Dashboard = () => {
    const { getProfile } = useUser()
    const { data } = getProfile()
    console.log(data);


    return (
        <div>
            <h2>Dashboard</h2>
            <p>{data?.data.first_name}</p>
            <p>{data?.data.last_name}</p>
            <p>{data?.data.phone_number}</p>
            <p>{data?.data.role}</p>
            <p>{data?.data.status}</p>
        </div>
    )
}

export default React.memo(Dashboard)