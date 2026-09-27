import { BrowserRouter, Routes, Route } from "react-router-dom"
import Home from "./pages/Home"
import Analyzing from "./pages/Analyzing"
import Result from "./pages/Result"
import Enrollment from "./pages/Enrollment"
import Dashboard from "./pages/Dashboard"
import CallDetail from "./pages/CallDetail"
import Analytics from "./pages/Analytics"
import Listen from "./pages/Listen"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/analyzing" element={<Analyzing />} />
        <Route path="/result" element={<Result />} />
        <Route path="/enroll" element={<Enrollment />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/call/:id" element={<CallDetail />} />
        <Route path="/listen" element={<Listen />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
