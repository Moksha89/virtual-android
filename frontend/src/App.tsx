import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import { Home } from './pages/Home'
import { AdminLogin } from './pages/AdminLogin'
import { AdminDashboard } from './pages/AdminDashboard'
import { UserLogin } from './pages/UserLogin'
import { UserDashboard } from './pages/UserDashboard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/login" element={<UserLogin />} />
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
