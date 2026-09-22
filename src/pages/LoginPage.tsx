import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { store, SystemConfig } from '../services/store';
import { supabase } from '../lib/supabase';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<SystemConfig>(store.getSystemConfig());

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Resend email activation states
  const [resendStatus, setResendStatus] = useState<'idle' | 'busy' | 'success' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState('');

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    const user = store.getCurrentUser();
    if (user && user.id !== 'guest' && user.active === true) {
      navigate('/dashboard', { replace: true });
    }

    const unsub = store.subscribe(() => {
      setConfig(store.getSystemConfig());
      const u = store.getCurrentUser();
      if (u && u.id !== 'guest' && u.active === true) {
        navigate('/dashboard', { replace: true });
      }
    });
    return unsub;
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ Email công vụ và Mật khẩu.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setResendStatus('idle');
    setResendMessage('');

    try {
      await store.signIn(email.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const msg = err?.message || 'Email hoặc mật khẩu không chính xác.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendActivation = async () => {
    if (!email.trim()) {
      setResendStatus('error');
      setResendMessage('Vui lòng nhập Email công vụ trước khi gửi lại yêu cầu kích hoạt.');
      return;
    }
    setResendStatus('busy');
    try {
      if (!supabase) throw new Error('Supabase client chưa sẵn sàng.');
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
      if (error) throw error;
      setResendStatus('success');
      setResendMessage('Đã gửi lại link kích hoạt email thành công! Vui lòng kiểm tra hộp thư đến.');
    } catch (err: any) {
      setResendStatus('error');
      setResendMessage(err?.message || 'Không thể gửi lại link kích hoạt.');
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-slate-100 text-slate-800 font-sans selection:bg-blue-600 selection:text-white">
      {/* Main Login Screen Container */}
      <div className="flex-1 flex flex-col lg:flex-row w-full">
        {/* Left Side: Clean Administrative Identity (System Title & Unit) */}
        <div className="lg:w-5/12 xl:w-1/2 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Background Decoration */}
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* Centered Title & Unit Section */}
          <div className="my-auto relative z-10 space-y-4 py-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black text-white tracking-tight leading-tight uppercase">
              {config.systemName || 'HỆ THỐNG TỔNG HỢP, ĐÁNH GIÁ TÌNH HÌNH TIẾP NHẬN, GIẢI QUYẾT THỦ TỤC HÀNH CHÍNH'}
            </h1>
            <p className="text-base sm:text-lg lg:text-xl font-semibold text-blue-200 leading-relaxed">
              {config.subTitle || 'Trung tâm Phục vụ hành chính công xã Chân Mây - Lăng Cô'}
            </p>
          </div>

          {/* Left Footer Badges */}
          <div className="relative z-10 pt-8 border-t border-blue-900/50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Máy chủ vận hành ổn định • TLS 1.3
            </span>
            <span className="text-[11px] text-slate-400">
              Phiên bản 2.6 Enterprise
            </span>
          </div>
        </div>

        {/* Right Side: Direct & Focused Login Form */}
        <div className="lg:w-7/12 xl:w-1/2 flex flex-col justify-between p-6 sm:p-10 lg:p-16 bg-white">
          {/* Centered Login Card */}
          <div className="w-full max-w-md mx-auto my-auto py-8">
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Đăng nhập Hệ thống
              </h2>
            </div>

            {/* Error & Warning Notification */}
            {errorMessage && (
              <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-2.5 animate-fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed flex-1">
                    {errorMessage.includes('Email not confirmed') ? (
                      <div className="space-y-2">
                        <p className="font-bold text-rose-900">
                          Tài khoản chưa được kích hoạt Email trong Supabase
                        </p>
                        <p className="text-[11px] text-slate-700 leading-normal">
                          Supabase đang bật chế độ bắt buộc xác thực email đăng ký. Bạn có thể giải quyết nhanh:
                        </p>
                        <div className="p-2.5 bg-white rounded-lg border border-rose-100 text-[10.5px] text-slate-700 space-y-1.5">
                          <p>
                            <strong>👉 Cách 1:</strong> Vào <strong>Supabase Dashboard</strong> &gt; <strong>Authentication</strong> &gt; <strong>Providers</strong> &gt; <strong>Email</strong> &gt; Tắt mục <strong>"Confirm email"</strong> để cho phép đăng nhập ngay.
                          </p>
                          <p>
                            <strong>👉 Cách 2:</strong> Bấm nút gửi lại link kích hoạt bên dưới và kiểm tra hòm thư của cán bộ.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="font-semibold text-rose-900">{errorMessage}</p>
                    )}
                  </div>
                </div>

                {errorMessage.includes('Email not confirmed') && (
                  <div className="pt-1 border-t border-rose-100 flex flex-col gap-1.5">
                    <button
                      type="button"
                      disabled={resendStatus === 'busy'}
                      onClick={handleResendActivation}
                      className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {resendStatus === 'busy' ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Đang gửi link kích hoạt...
                        </>
                      ) : (
                        'Gửi lại link kích hoạt Email'
                      )}
                    </button>
                    {resendMessage && (
                      <p className={`text-[11px] font-bold text-center ${
                        resendStatus === 'success' ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        {resendMessage}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Email công vụ <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="canbo@domain.gov.vn"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Mật khẩu <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-600">
                    Ghi nhớ phiên đăng nhập trên trình duyệt này
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang xác thực thông tin...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Đăng nhập vào Hệ thống</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Form Bottom Right Mandatory Branding / Signature */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-400">
            <span className="text-[11px]">
              Bảo mật hệ thống • Supabase PostgreSQL RLS
            </span>
            <span className="text-[11px] font-medium text-slate-400 select-none tracking-wide text-right">
              @2026 Design by Lê Hồng Sơn
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
