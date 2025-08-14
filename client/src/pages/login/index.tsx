import React, { useState, type FormEvent } from 'react'
import type { IData } from '../../types'
import { useUser } from '../../api/hooks/useUser'
import { useNavigate } from 'react-router-dom'

const initialState: IData = {
    phone_number: '',
    password: ''
}

const Login = () => {
    const { Login } = useUser()
    const [formLogin, setFormLogin] = useState<IData>(initialState)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { value, name } = e.target;
        setFormLogin((p) => ({ ...p, [name]: value }));
    }

    const navigate = useNavigate()

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        Login.mutate(formLogin, {
            onSuccess: ({ data }) => {
                localStorage.setItem('token', `${data.data}`)
                navigate('/dashboard')
                setFormLogin(initialState);
            },
        });
    };

    return (
        <div>
            <form onSubmit={handleSubmit} action="">
                <input className='border' required name='phone_number' value={formLogin.phone_number} onChange={handleChange} type="text" placeholder='Phone number' />
                <input className='border' required name='password' value={formLogin.password} onChange={handleChange} type="text" placeholder='Password' />
                <button className='border'>Kirish</button>
            </form>
        </div>
    )
}

export default React.memo(Login)