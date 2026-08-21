"use client";

// Browser dialer for the admin area. One Twilio leg: browser -> Twilio ->
// UK number, presenting the WMI 020. A fresh token and Device are created
// per call, which keeps the component free of token-expiry plumbing.
import { useEffect, useRef, useState } from "react";
import { Device, Call } from "@twilio/voice-sdk";

type Status = "idle" | "connecting" | "ringing" | "in-call" | "error";

const KEYPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

export function Dialer() {
  const [number, setNumber] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const teardown = (finalStatus: Status, note: string) => {
    stopTimer();
    callRef.current = null;
    deviceRef.current?.destroy();
    deviceRef.current = null;
    setMuted(false);
    setStatus(finalStatus);
    setMessage(note);
  };

  const placeCall = async () => {
    setStatus("connecting");
    setMessage("");
    setSeconds(0);
    try {
      const res = await fetch("/api/twilio/token");
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !data.token) throw new Error(data.error ?? "Could not get a calling token.");

      const device = new Device(data.token, {
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      });
      deviceRef.current = device;
      device.on("error", (err: { message?: string }) => {
        teardown("error", err.message ?? "Device error.");
      });

      const call = await device.connect({ params: { To: number } });
      callRef.current = call;
      setStatus("ringing");

      call.on("accept", () => {
        setStatus("in-call");
        timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      });
      call.on("disconnect", () => teardown("idle", "Call ended."));
      call.on("cancel", () => teardown("idle", "Call cancelled."));
      call.on("error", (err: { message?: string }) => {
        teardown("error", err.message ?? "Call error.");
      });
    } catch (err) {
      teardown("error", err instanceof Error ? err.message : "Could not place the call.");
    }
  };

  const hangUp = () => {
    callRef.current?.disconnect();
    // disconnect fires the teardown via the event; this covers the pre-accept case.
    if (!callRef.current) teardown("idle", "");
  };

  const toggleMute = () => {
    const call = callRef.current;
    if (!call) return;
    call.mute(!muted);
    setMuted(!muted);
  };

  const sendDigit = (d: string) => callRef.current?.sendDigits(d);

  const busy = status === "connecting" || status === "ringing" || status === "in-call";
  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="max-w-sm space-y-4">
      <input
        type="tel"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !busy && number.trim()) void placeCall();
        }}
        placeholder="020 7946 0018 or 07…"
        disabled={busy}
        className="w-full rounded-md border border-gray-300 px-4 py-3 text-lg tracking-wide focus:border-[#0B1F3A] focus:outline-none disabled:bg-gray-50"
      />

      <div className="flex items-center gap-3">
        {!busy ? (
          <button
            onClick={() => void placeCall()}
            disabled={!number.trim()}
            className="rounded-md bg-[#0B1F3A] px-6 py-3 text-white transition-colors hover:bg-[#13305a] disabled:opacity-40"
          >
            Call
          </button>
        ) : (
          <>
            <button
              onClick={hangUp}
              className="rounded-md bg-red-700 px-6 py-3 text-white transition-colors hover:bg-red-800"
            >
              Hang up
            </button>
            {status === "in-call" && (
              <button
                onClick={toggleMute}
                className={`rounded-md border px-4 py-3 transition-colors ${muted ? "border-amber-600 bg-amber-50 text-amber-800" : "border-gray-300 hover:bg-gray-50"}`}
              >
                {muted ? "Unmute" : "Mute"}
              </button>
            )}
          </>
        )}
        <span className="text-sm text-gray-600">
          {status === "connecting" && "Connecting…"}
          {status === "ringing" && "Ringing…"}
          {status === "in-call" && `In call · ${mmss}`}
          {(status === "idle" || status === "error") && message}
        </span>
      </div>

      {status === "in-call" && (
        <div className="grid w-48 grid-cols-3 gap-2">
          {KEYPAD.map((d) => (
            <button
              key={d}
              onClick={() => sendDigit(d)}
              className="rounded-md border border-gray-300 py-2 text-lg hover:bg-gray-50"
            >
              {d}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">
        Calls present 020 4538 3367. Normal UK ranges only (01, 02, 03, 07); premium-rate numbers are refused.
      </p>
    </div>
  );
}
