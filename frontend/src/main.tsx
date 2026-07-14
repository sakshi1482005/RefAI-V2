import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App'
import Login from './pages/auth'
import StudentDashboard from './pages/StudentDashboard'
import EmployeeReview from './pages/EmployeeReview'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />

        <Route path="/dashboard" element={<StudentDashboard />} />
        <Route
          path="/dashboard/student"
          element={<Navigate to="/dashboard" replace />}
        />

        <Route path="/review/:candidateId" element={<EmployeeReview />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
