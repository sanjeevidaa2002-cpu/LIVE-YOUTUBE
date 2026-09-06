import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import ProtectedRoute from "@/components/ProtectedRoute";

import MainLayout from "@/layouts/MainLayout";
import AuthLayout from "@/layouts/AuthLayout";
import AdminLayout from "@/layouts/AdminLayout";
import ManagerLayout from "@/layouts/ManagerLayout";

import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";

import Home from "@/pages/user/Home";
import Videos from "@/pages/user/Videos";
import VideoDetails from "@/pages/user/VideoDetails";
import CategoryPage from "@/pages/user/Category";
import Profile from "@/pages/user/Profile";

import AdminDashboard from "@/pages/admin/Dashboard";
import AdminVideos from "@/pages/admin/Videos";
import AdminUploadVideo from "@/pages/admin/UploadVideo";
import AdminEditVideo from "@/pages/admin/EditVideo";
import AdminUsers from "@/pages/admin/Users";
import AdminManagers from "@/pages/admin/Managers";
import AdminCategories from "@/pages/admin/Categories";
import AdminAnalytics from "@/pages/admin/Analytics";
import AdminSettings from "@/pages/admin/Settings";

import ManagerDashboard from "@/pages/manager/Dashboard";
import ManagerVideos from "@/pages/manager/Videos";
import ManagerUploadVideo from "@/pages/manager/UploadVideo";
import ManagerEditVideo from "@/pages/manager/EditVideo";
import ManagerProfile from "@/pages/manager/Profile";

import AccountDisabled from "@/pages/AccountDisabled";
import NotFound from "@/pages/NotFound";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public / user-facing */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/videos" element={<Videos />} />
            <Route path="/videos/:id" element={<VideoDetails />} />
            <Route path="/categories/:slug" element={<CategoryPage />} />

            <Route element={<ProtectedRoute allowedRoles={["user", "manager", "admin"]} />}>
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Route>

          {/* Auth */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Route>

          <Route path="/account-disabled" element={<AccountDisabled />} />

          {/* Admin */}
          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/videos" element={<AdminVideos />} />
              <Route path="/admin/videos/upload" element={<AdminUploadVideo />} />
              <Route path="/admin/videos/:id/edit" element={<AdminEditVideo />} />
              <Route path="/admin/categories" element={<AdminCategories />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/managers" element={<AdminManagers />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
            </Route>
          </Route>

          {/* Manager */}
          <Route element={<ProtectedRoute allowedRoles={["manager", "admin"]} />}>
            <Route element={<ManagerLayout />}>
              <Route path="/manager" element={<ManagerDashboard />} />
              <Route path="/manager/videos" element={<ManagerVideos />} />
              <Route path="/manager/videos/upload" element={<ManagerUploadVideo />} />
              <Route path="/manager/videos/:id/edit" element={<ManagerEditVideo />} />
              <Route path="/manager/profile" element={<ManagerProfile />} />
            </Route>
          </Route>

          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}
