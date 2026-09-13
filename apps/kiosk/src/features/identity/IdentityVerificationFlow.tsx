import { useState, useRef, useEffect, useCallback } from "react";
import "./IdentityVerification.css";

// IDCapture Component
// Re-uses camera logic similar to CameraPresenceDetector but displays a video feed and captures a frame.
export function IDCapture({ onCapture, onCancel }: { onCapture: (dataUrl: string) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      .then((mediaStream) => {
        if (!active) return mediaStream.getTracks().forEach((t) => t.stop());
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      })
      .catch((err) => {
        console.error("Failed to get camera access:", err);
      });
      
    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCapture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        onCapture(dataUrl);
      }
    }
  }, [onCapture]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="id-capture">
      <h3>Please show your ID to the camera</h3>
      <p className="hint">Ensure your face and details are clearly visible.</p>
      
      <div className="video-container">
        <video ref={videoRef} autoPlay playsInline muted />
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
      
      <div className="capture-actions">
        <button className="secondary-action" onClick={onCancel}>Cancel</button>
        <button className="primary-action" onClick={handleCapture}>Capture ID</button>
      </div>
    </div>
  );
}

export function IdentityVerificationFlow({
  onVerified,
  requestOTP,
  verifyOTP,
  registerPatient,
  onStepChange,
}: {
  onVerified?: () => void;
  requestOTP: (phone: string) => Promise<{ success: boolean; message?: string }>;
  verifyOTP: (phone: string, code: string) => Promise<{ success: boolean; patient?: any; message?: string }>;
  registerPatient: (name: string, phone: string, address?: string, idPhotoRef?: string) => void;
  onStepChange?: (step: string) => void;
}) {
  const [step, setStep] = useState<"choice" | "existing-phone" | "existing-otp" | "new" | "capture">("choice");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const changeStep = (nextStep: "choice" | "existing-phone" | "existing-otp" | "new" | "capture") => {
    setErrorMsg(null);
    setInfoMsg(null);
    setStep(nextStep);
    const stepKey =
      nextStep === "new" ? "new-info" :
      nextStep;
    onStepChange?.(stepKey);
  };

  const handleSendOTP = async () => {
    if (!phone.trim()) {
      setErrorMsg("Please enter your registered phone number.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await requestOTP(phone.trim());
      if (res.success) {
        if (res.message) {
          setInfoMsg(res.message);
        }
        changeStep("existing-otp");
      } else {
        setErrorMsg(res.message || "Failed to send verification code. Please check your number.");
      }
    } catch {
      setErrorMsg("Error communicating with server.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode.trim()) {
      setErrorMsg("Please enter the verification code.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await verifyOTP(phone.trim(), otpCode.trim());
      if (res.success) {
        onVerified?.();
      } else {
        setErrorMsg(res.message || "Invalid or expired verification code.");
      }
    } catch {
      setErrorMsg("Error verifying code with server.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "choice") {
    return (
      <div className="identity-flow option-group">
        <p className="option-group-label">Patient Verification</p>
        <p className="hint" style={{ marginBottom: "1rem" }}>
          Before getting your OP ticket, please verify your identity.
        </p>
        <div className="option-cards">
          <button className="option-card" onClick={() => changeStep("existing-phone")}>
            <span className="option-card-title">Existing Patient</span>
            <span className="option-card-detail">I have visited here before</span>
          </button>
          <button className="option-card" onClick={() => changeStep("new")}>
            <span className="option-card-title">New Patient</span>
            <span className="option-card-detail">This is my first visit</span>
          </button>
        </div>
      </div>
    );
  }

  if (step === "existing-phone") {
    return (
      <div className="identity-flow option-group">
        <p className="option-group-label">Verify Existing Patient</p>
        <p className="hint" style={{ marginBottom: "1rem" }}>
          Enter your registered phone number to receive a verification code.
        </p>
        {errorMsg && <p className="identity-error">{errorMsg}</p>}
        <div className="form-group">
          <input
            type="tel"
            placeholder="Registered Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="identity-actions">
          <button className="secondary-action" onClick={() => changeStep("choice")} disabled={loading}>
            Back
          </button>
          <button className="primary-action" onClick={handleSendOTP} disabled={loading}>
            {loading ? "Sending Code..." : "Send Verification Code"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "existing-otp") {
    return (
      <div className="identity-flow option-group">
        <p className="option-group-label">Enter Verification Code</p>
        <p className="hint" style={{ marginBottom: "0.5rem" }}>
          Enter the verification code sent to {phone}.
        </p>
        {infoMsg && <p className="identity-hint" style={{ color: "var(--accent)" }}>{infoMsg}</p>}
        {errorMsg && <p className="identity-error">{errorMsg}</p>}
        <div className="form-group">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="6-digit Code"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            disabled={loading}
            autoFocus
          />
        </div>
        <div className="identity-actions">
          <button className="secondary-action" onClick={() => changeStep("existing-phone")} disabled={loading}>
            Change Number
          </button>
          <button className="primary-action" onClick={handleVerifyOTP} disabled={loading}>
            {loading ? "Verifying..." : "Verify Code"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "new") {
    return (
      <div className="identity-flow option-group">
        <p className="option-group-label">Register New Patient</p>
        {errorMsg && <p className="identity-error">{errorMsg}</p>}
        <div className="form-group">
          <input
            type="text"
            placeholder="Full Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="tel"
            placeholder="Phone Number *"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            type="text"
            placeholder="Address (Optional)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div className="identity-actions">
          <button className="secondary-action" onClick={() => changeStep("choice")}>
            Back
          </button>
          <button
            className="primary-action"
            onClick={() => {
              if (!name.trim() || !phone.trim()) {
                setErrorMsg("Name and Phone Number are required.");
                return;
              }
              changeStep("capture");
            }}
          >
            Proceed to ID Capture
          </button>
        </div>
      </div>
    );
  }

  if (step === "capture") {
    return (
      <div className="identity-flow option-group">
        <IDCapture
          onCancel={() => changeStep("new")}
          onCapture={(dataUrl) => {
            registerPatient(name, phone, address, dataUrl);
          }}
        />
      </div>
    );
  }

  return null;
}
