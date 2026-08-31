import { Routes, Route } from 'react-router-dom'
import Layout from './components/blog/Layout'
import Home from './pages/Home'
import PostDetail from './pages/PostDetail'
import Archive from './pages/Archive'

// Pathless parent route: Layout renders once and stays mounted, while the
// child routes swap through its <Outlet />.
export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
      <Route path="/" element={<Home />} />
      <Route path="/posts/*" element={<PostDetail />} />
      <Route path="/archive" element={<Archive />} />
    </Route>
  </Routes>
)
}
