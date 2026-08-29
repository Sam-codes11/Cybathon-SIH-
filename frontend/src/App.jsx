import { BrowserRouter, Routes, Route } from "react-router-dom"
import Home from "./pages/Home"
import Analyzing from "./pages/Analyzing"
import Result from "./pages/Result"
import Enrollment from "./pages/Enrollment"
import Dashboard from "./pages/Dashboard"
import CallDetail from "./pages/CallDetail"
import VoiceRecorder from "./VoiceRecorder"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/analyzing" element={<Analyzing />} />
        <Route path="/result" element={<Result />} />
        <Route path="/enroll" element={<Enrollment />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/call/:id" element={<CallDetail />} />
        <Route path="/recorder" element={<VoiceRecorder/>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
