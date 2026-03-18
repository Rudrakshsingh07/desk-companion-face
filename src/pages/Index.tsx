import { useAppState } from "@/hooks/useAppState";
import { IdleScreen } from "@/components/IdleScreen";
import { LockedScreen } from "@/components/LockedScreen";
import { LoginScreen } from "@/components/LoginScreen";
import { DashboardScreen } from "@/components/DashboardScreen";
import { AdminScreen } from "@/components/AdminScreen";

const Index = () => {
  const {
    state, userId, sessionToken, sessionRole,
    analytics, videoRef, canvasRef, sessionStartRef,
    handleManualLogin, handleLogout, handleLock, showLogin, cancelLogin,
    retryRecognition, cancelLocked, showAdmin, backToDashboard,
  } = useAppState();

  const isAdmin = userId === "admin";

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden bg-background">
      <video ref={videoRef} className="hidden" playsInline muted autoPlay />
      <canvas ref={canvasRef} className="hidden" />

      {state === "idle" && <IdleScreen onManualLogin={showLogin} />}
      {state === "locked" && <LockedScreen onRetry={retryRecognition} onManualLogin={showLogin} />}
      {state === "login" && <LoginScreen onLogin={handleManualLogin} onCancel={cancelLogin} />}
      {state === "authenticated" && (
        <DashboardScreen
          userId={userId}
          token={sessionToken}
          role={sessionRole}
          analytics={analytics}
          sessionStartRef={sessionStartRef}
          onLogout={handleLogout}
          onLock={handleLock}
          onAdmin={showAdmin}
          isAdmin={isAdmin}
        />
      )}
      {state === "admin" && (
        <AdminScreen
          analytics={analytics}
          sessionStartRef={sessionStartRef}
          onBack={backToDashboard}
        />
      )}
    </div>
  );
};

export default Index;
