import { useState, useEffect, useReducer, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import productImg from "@/imports/BuyerView/efd3b0e58fa883c7f5794b13db7b8b01e4dc22a7.png";
import fleekLogo from "@/imports/Logo_fleek.png";

// ─── Types ────────────────────────────────────────────────────────────────────
type AuctionStatus = "draft" | "live" | "closed";
type Leader = "none" | "primary" | "rival" | "buy-now";
type View = "seller" | "market" | "buyer";
type BuyerTab = "buy-now" | "place-bid";
type ActivityTab = "public" | "private";

interface AuctionState {
  status: AuctionStatus;
  startPrice: number;
  buyNowPrice: number;
  currentPrice: number;
  secondsRemaining: number;
  primaryMaximum: number | null;
  rivalMaximum: number | null;
  leader: Leader;
  bidCount: number;
  closeReason: "auction" | "buy-now" | null;
  fulfilment: "Pending Fleek QC" | null;
  publicEvents: string[];
  privateBuyerEvents: string[];
}

const INITIAL_STATE: AuctionState = {
  status: "draft",
  startPrice: 520,
  buyNowPrice: 760,
  currentPrice: 520,
  secondsRemaining: 90,
  primaryMaximum: null,
  rivalMaximum: null,
  leader: "none",
  bidCount: 0,
  closeReason: null,
  fulfilment: null,
  publicEvents: [],
  privateBuyerEvents: [],
};

// ─── Proxy price logic ────────────────────────────────────────────────────────
function computePrice(
  primaryMax: number | null,
  rivalMax: number | null,
  startPrice: number
): number {
  const INC = 10;
  const maxima = [primaryMax, rivalMax].filter((v): v is number => v !== null);
  if (maxima.length === 0) return startPrice;
  if (maxima.length === 1) return startPrice; // no competition — stay at start
  const [hi, lo] = [...maxima].sort((a, b) => b - a);
  return Math.max(Math.min(hi, lo + INC), startPrice);
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
type Action =
  | { type: "PUBLISH"; start: number; buyNow: number }
  | { type: "APPROVE_PRIMARY"; max: number }
  | { type: "RIVAL_BID"; rivalMax: number }
  | { type: "BUY_NOW" }
  | { type: "TICK" }
  | { type: "ADVANCE_CLOSE" }
  | { type: "REPLAY" }
  | { type: "RESET" };

function reducer(s: AuctionState, a: Action): AuctionState {
  switch (a.type) {
    case "PUBLISH":
      return {
        ...INITIAL_STATE,
        status: "live",
        startPrice: a.start,
        buyNowPrice: a.buyNow,
        currentPrice: a.start,
        secondsRemaining: 90,
        publicEvents: [`Auction published · Starting bid £${a.start}`],
      };

    case "APPROVE_PRIMARY": {
      if (s.status !== "live") return s;
      if (s.primaryMaximum !== null && a.max <= s.primaryMaximum) return s;
      const newPrice = computePrice(a.max, s.rivalMaximum, s.startPrice);
      const leader: Leader =
        s.rivalMaximum === null ? "primary" : a.max > s.rivalMaximum ? "primary" : "rival";
      const pub = [...s.publicEvents];
      const priv = [...s.privateBuyerEvents];
      priv.push(`Maximum approved · £${a.max}`);
      priv.push("Proxy agent activated");
      if (newPrice > s.currentPrice) pub.push(`Automatic bid · Current price £${newPrice}`);
      priv.push(leader === "primary" ? "Proxy retained the lead" : "Proxy stopped · You've been outbid");
      return {
        ...s,
        primaryMaximum: a.max,
        currentPrice: newPrice,
        leader,
        bidCount: s.bidCount + 1,
        publicEvents: pub,
        privateBuyerEvents: priv,
      };
    }

    case "RIVAL_BID": {
      if (s.status !== "live") return s;
      const newPrice = computePrice(s.primaryMaximum, a.rivalMax, s.startPrice);
      const leader: Leader =
        s.primaryMaximum === null ? "rival" : a.rivalMax > s.primaryMaximum ? "rival" : "primary";
      const pub = [...s.publicEvents];
      const priv = [...s.privateBuyerEvents];
      if (newPrice > s.currentPrice) pub.push(`Automatic bid · Current price £${newPrice}`);
      if (s.primaryMaximum !== null)
        priv.push(leader === "primary" ? "Proxy retained the lead" : "Proxy stopped · You've been outbid");
      return {
        ...s,
        rivalMaximum: a.rivalMax,
        currentPrice: newPrice,
        leader,
        bidCount: s.bidCount + 1,
        publicEvents: pub,
        privateBuyerEvents: priv,
      };
    }

    case "BUY_NOW":
      if (s.status !== "live") return s;
      return {
        ...s,
        status: "closed",
        currentPrice: s.buyNowPrice,
        leader: "buy-now",
        closeReason: "buy-now",
        fulfilment: "Pending Fleek QC",
        secondsRemaining: 0,
        publicEvents: [...s.publicEvents, `Buy Now · Closed at £${s.buyNowPrice}`],
        privateBuyerEvents: [...s.privateBuyerEvents, "Purchased at Buy Now · Pending Fleek QC"],
      };

    case "TICK":
      if (s.status !== "live") return s;
      if (s.secondsRemaining <= 1) {
        return {
          ...s,
          status: "closed",
          secondsRemaining: 0,
          closeReason: "auction",
          fulfilment: "Pending Fleek QC",
          publicEvents: [...s.publicEvents, "Auction sold"],
        };
      }
      return { ...s, secondsRemaining: s.secondsRemaining - 1 };

    case "ADVANCE_CLOSE":
      if (s.status !== "live") return s;
      return {
        ...s,
        status: "closed",
        secondsRemaining: 0,
        closeReason: "auction",
        fulfilment: "Pending Fleek QC",
        publicEvents: [...s.publicEvents, "Auction sold"],
      };

    case "REPLAY":
      return {
        ...s,
        status: "live",
        currentPrice: s.startPrice,
        secondsRemaining: 90,
        primaryMaximum: null,
        rivalMaximum: null,
        leader: "none",
        bidCount: 0,
        closeReason: null,
        fulfilment: null,
        publicEvents: [`Auction published · Starting bid £${s.startPrice}`],
        privateBuyerEvents: [],
      };

    case "RESET":
      return { ...INITIAL_STATE };

    default:
      return s;
  }
}

// ─── Small shared UI ──────────────────────────────────────────────────────────
function PrivateBadge() {
  return (
    <span className="inline-flex items-center gap-1 bg-[#efecff] text-[#5b42cc] text-[9px] font-extrabold font-['Manrope'] px-1.5 py-0.5 rounded-full whitespace-nowrap">
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden>
        <path d="M7.5 4.875C7.5 6.75 6.1875 7.6875 4.6275 8.23125C4.54581 8.25893 4.45708 8.25761 4.37625 8.2275C2.8125 7.6875 1.5 6.75 1.5 4.875V2.25C1.5 2.15054 1.53951 2.05516 1.60984 1.98484C1.68016 1.91451 1.77554 1.875 1.875 1.875C2.625 1.875 3.5625 1.425 4.215 0.855C4.29445 0.787125 4.39551 0.749831 4.5 0.749831C4.60449 0.749831 4.70555 0.787125 4.785 0.855C5.44125 1.42875 6.375 1.875 7.125 1.875C7.22446 1.875 7.31984 1.91451 7.39017 1.98484C7.46049 2.05516 7.5 2.15054 7.5 2.25V4.875Z" stroke="#5B42CC" strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3.375 4.5L4.125 5.25L5.625 3.75" stroke="#5B42CC" strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Private to you
    </span>
  );
}

function PublicBadge() {
  return (
    <span className="inline-flex items-center gap-1 bg-[#efefeb] text-[#77776f] text-[9px] font-extrabold font-['Manrope'] px-1.5 py-0.5 rounded-full whitespace-nowrap">
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden>
        <path d="M0.77325 4.3695C0.741997 4.45369 0.741997 4.54631 0.77325 4.6305C1.07764 5.36855 1.59432 5.99961 2.25779 6.44366C2.92126 6.88772 3.70164 7.12477 4.5 7.12477C5.29836 7.12477 6.07874 6.88772 6.74221 6.44366C7.40568 5.99961 7.92236 5.36855 8.22675 4.6305C8.258 4.54631 8.258 4.45369 8.22675 4.3695C7.92236 3.63145 7.40568 3.00039 6.74221 2.55634C6.07874 2.11228 5.29836 1.87523 4.5 1.87523C3.70164 1.87523 2.92126 2.11228 2.25779 2.55634C1.59432 3.00039 1.07764 3.63145 0.77325 4.3695Z" stroke="#77776F" strokeWidth="0.75"/>
        <circle cx="4.5" cy="4.5" r="1.125" fill="#77776F"/>
      </svg>
      Public
    </span>
  );
}

function StatusBadge({ status }: { status: AuctionStatus }) {
  if (status === "live")
    return (
      <span className="inline-flex items-center gap-1.5 bg-[#dcfce7] text-[#15803d] text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-[#15803d] animate-pulse" />
        LIVE AUCTION
      </span>
    );
  if (status === "closed")
    return (
      <span className="inline-flex items-center gap-1.5 bg-[#f1f5f9] text-[#64748b] text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide">
        CLOSED
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 bg-[#fef9c3] text-[#854d0e] text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide">
      DRAFT
    </span>
  );
}


function FulfilmentBadge() {
  return (
    <div className="flex items-center gap-2 bg-[#dcfce7] border border-[#86efac] rounded-xl px-4 py-3">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
        <circle cx="9" cy="9" r="8" fill="#15803d"/>
        <path d="M5.5 9L7.5 11L12 6.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div>
        <p className="text-[#15803d] text-[12px] font-extrabold font-['Manrope']">Pending Fleek QC</p>
        <p className="text-[#16a34a] text-[11px] font-['Manrope']">Auction successfully closed</p>
      </div>
    </div>
  );
}

// ─── Countdown formatter ──────────────────────────────────────────────────────
function formatCountdown(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return {
    h: String(h).padStart(2, "0"),
    m: String(m).padStart(2, "0"),
    s: String(s).padStart(2, "0"),
  };
}

// ─── FleekNav ─────────────────────────────────────────────────────────────────
function FleekNav({ role, onRoleChange }: { role?: "seller" | "buyer"; onRoleChange?: (r: "seller" | "buyer") => void }) {
  return (
    <header className="bg-white border-b border-[#e5e7eb] sticky top-0 z-40">
      <div className="max-w-[1280px] mx-auto h-[60px] flex items-center gap-4 px-6">
        {/* Logo */}
        <div className="flex items-center shrink-0">
          <img src={fleekLogo} alt="Fleek" className="h-[26px] object-contain" />
        </div>
        {/* Nav */}
        <nav className="flex items-center gap-0.5">
          {[
            { label: "Categories" },
            { label: "Brands" },
            { label: "Suppliers" },
          ].map((item) => (
            <button
              key={item.label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[#4a5565] text-[13px] font-medium font-['DM_Sans'] hover:bg-gray-100 transition-colors"
            >
              {item.label}
            </button>
          ))}
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#fdc700] text-[#0c0c0f] text-[13px] font-semibold font-['DM_Sans']">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
              <path d="M7.85417 6.77083L3.52083 11.1042C3.30534 11.3197 3.01308 11.4407 2.70833 11.4407C2.40359 11.4407 2.11132 11.3197 1.89583 11.1042C1.68034 10.8887 1.55928 10.5964 1.55928 10.2917C1.55928 9.98692 1.68034 9.69466 1.89583 9.47917L6.22917 5.14583" stroke="#0C0C0F" strokeWidth="1.08" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8.66667 8.66667L11.9167 5.41667" stroke="#0C0C0F" strokeWidth="1.08" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4.33333 4.33333L7.58333 1.08333" stroke="#0C0C0F" strokeWidth="1.08" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Auction
          </button>
        </nav>
        {/* Search */}
        <div className="flex-1 mx-4 max-w-[240px]">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#99a1af]" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M6.41667 11.0833C8.994 11.0833 11.0833 8.994 11.0833 6.41667C11.0833 3.83934 8.994 1.75 6.41667 1.75C3.83934 1.75 1.75 3.83934 1.75 6.41667C1.75 8.994 3.83934 11.0833 6.41667 11.0833Z" stroke="#99A1AF" strokeWidth="1.17" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12.25 12.25L9.74167 9.74167" stroke="#99A1AF" strokeWidth="1.17" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <input
              className="w-full h-[36px] rounded-[10px] border border-[#d1d5dc] pl-8 pr-4 text-[13px] text-[#99a1af] font-['DM_Sans'] bg-white outline-none focus:border-[#fdc700] transition-colors"
              placeholder='Search for "Y2K"'
            />
          </div>
        </div>
        {/* Right actions */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          <button className="px-2.5 py-1.5 text-[13px] font-medium text-[#4a5565] font-['DM_Sans'] flex items-center gap-0.5">
            EN <span className="text-[10px]">▾</span>
          </button>
          <button className="px-2.5 py-1.5 text-[13px] font-medium text-[#4a5565] font-['DM_Sans'] flex items-center gap-0.5">
            GB £ <span className="text-[10px]">▾</span>
          </button>
          <button className="relative p-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M5.33333 14.6667C5.70152 14.6667 6 14.3682 6 14C6 13.6318 5.70152 13.3333 5.33333 13.3333C4.96514 13.3333 4.66667 13.6318 4.66667 14C4.66667 14.3682 4.96514 14.6667 5.33333 14.6667Z" stroke="#4A5565" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12.6667 14.6667C13.0349 14.6667 13.3333 14.3682 13.3333 14C13.3333 13.6318 13.0349 13.3333 12.6667 13.3333C12.2985 13.3333 12 13.6318 12 14C12 14.3682 12.2985 14.6667 12.6667 14.6667Z" stroke="#4A5565" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1.36667 1.36667H2.7L4.47333 9.64667C4.53839 9.94991 4.70711 10.221 4.95047 10.4132C5.19383 10.6055 5.4966 10.7069 5.80667 10.7H12.3267C12.6301 10.6995 12.9243 10.5955 13.1607 10.4052C13.397 10.2149 13.5614 9.94969 13.6267 9.65333L14.7267 4.7H3.41333" stroke="#4A5565" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="absolute top-0.5 left-3.5 bg-[#fdc700] text-[#0c0c0f] text-[9px] font-bold w-[14px] h-[14px] rounded-full flex items-center justify-center font-['DM_Sans']">
              2
            </span>
          </button>
          {/* Seller / Buyer toggle */}
          {role !== undefined && onRoleChange && (
            <div className="flex items-center bg-[#f3f4f6] rounded-[10px] p-[3px] ml-2">
              {(["seller", "buyer"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => onRoleChange(r)}
                  className={`px-4 py-1.5 rounded-[8px] text-[13px] font-semibold font-['DM_Sans'] transition-all ${
                    role === r ? "bg-[#0c0c0f] text-white shadow-sm" : "text-[#6d6c67] hover:text-[#151515]"
                  }`}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── PriceInput component ─────────────────────────────────────────────────────
interface PriceInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  badge: "private" | "public";
  error?: string;
  disabled?: boolean;
}
function PriceInput({ label, value, onChange, badge, error, disabled }: PriceInputProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center justify-between">
        <label className="text-[13px] font-extrabold font-['Manrope'] text-[#171717]">{label}</label>
        {badge === "private" ? <PrivateBadge /> : <PublicBadge />}
      </div>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[16px] font-extrabold font-['Manrope'] text-[#151515] pointer-events-none">
          £
        </span>
        <input
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full h-[48px] rounded-[18px] border pl-7 pr-3 text-[16px] font-extrabold font-['Manrope'] text-[#151515] bg-white outline-none transition-colors ${
            error ? "border-red-400 focus:border-red-500" : "border-[#d7d6d0] focus:border-[#fdc700]"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        />
      </div>
      {error && <p className="text-red-500 text-[11px] font-['Manrope']">{error}</p>}
    </div>
  );
}

// ─── Price Range Bar ──────────────────────────────────────────────────────────
// Shared helper: maps a value onto a 0–100% position within [lo, hi]
function pct(value: number, lo: number, hi: number) {
  if (hi <= lo) return 0;
  return Math.min(100, Math.max(0, ((value - lo) / (hi - lo)) * 100));
}

function PriceRangeBar({
  startPrice,
  buyNowPrice,
}: {
  startPrice: number;
  buyNowPrice: number;
}) {
  const hasValues = startPrice > 0 && buyNowPrice > 0;

  return (
    <div className="w-full pt-2 pb-6 relative select-none">
      {/* Track — grey until both prices entered, yellow once set */}
      <div className={`relative h-[6px] rounded-full mx-2.5 ${hasValues ? "bg-[#fdc700]" : "bg-[#d1d5dc]"}`}>
        {hasValues && (
          <>
            {/* startBid anchor — left */}
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-0 w-[18px] h-[18px] rounded-full bg-white border-[3px] border-[#fdc700] shadow-sm" />
            {/* buyNow anchor — right */}
            <div className="absolute top-1/2 -translate-y-1/2 translate-x-1/2 right-0 w-[18px] h-[18px] rounded-full bg-white border-[3px] border-[#fdc700] shadow-sm" />
          </>
        )}
      </div>
      {/* Labels */}
      <div className="relative mt-2.5 h-5 text-[11px] font-['DM_Sans'] text-[#888896]">
        {hasValues ? (
          <>
            <span className="absolute left-0">£{startPrice}</span>
            <span className="absolute right-0">£{buyNowPrice}</span>
          </>
        ) : (
          <span className="text-[#99a1af]">Enter prices above to preview</span>
        )}
      </div>
    </div>
  );
}

// ─── BidSlider ────────────────────────────────────────────────────────────────
// Custom drag slider matching the seller price range bar.
// Fixed anchors: startBid (left, yellow) · buyNow (right, yellow)
// Draggable thumb: user's chosen maximum (dark border)
function BidSlider({
  startPrice,
  buyNowPrice,
  value,
  onChange,
  disabled,
}: {
  startPrice: number;
  buyNowPrice: number;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const lo = startPrice;
  const hi = buyNowPrice - 10;
  const valuePct = pct(value, lo, buyNowPrice);

  function valueFromClientX(clientX: number) {
    if (!trackRef.current) return value;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = lo + ratio * (buyNowPrice - lo);
    return Math.min(hi, Math.max(lo, Math.round(raw / 10) * 10));
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (disabled) return;
    e.preventDefault();
    dragging.current = true;
    onChange(valueFromClientX(e.clientX));

    function onMove(e: MouseEvent) {
      if (dragging.current) onChange(valueFromClientX(e.clientX));
    }
    function onUp() {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (disabled) return;
    onChange(valueFromClientX(e.touches[0].clientX));
  }

  return (
    <div className={`w-full py-2 select-none ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-[6px] rounded-full mx-2.5 cursor-pointer"
        style={{ background: "#e5e7eb" }}
        onMouseDown={handleMouseDown}
        onTouchMove={handleTouchMove}
      >
        {/* Yellow fill from left to value thumb */}
        <div
          className="absolute top-0 bottom-0 bg-[#fdc700] rounded-full left-0 pointer-events-none"
          style={{ width: `${valuePct}%` }}
        />
        {/* startBid anchor (left, yellow border) */}
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-0 w-[18px] h-[18px] rounded-full bg-white border-[3px] border-[#fdc700] shadow-sm pointer-events-none" />
        {/* buyNow anchor (right, yellow border) */}
        <div className="absolute top-1/2 -translate-y-1/2 translate-x-1/2 right-0 w-[18px] h-[18px] rounded-full bg-white border-[3px] border-[#fdc700] shadow-sm pointer-events-none" />
        {/* User max thumb (dark border, draggable) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[22px] h-[22px] rounded-full bg-white border-[3px] border-[#0c0c0f] shadow-md pointer-events-none z-10"
          style={{ left: `${valuePct}%` }}
        />
      </div>
      {/* Labels */}
      <div className="relative mt-2.5 h-5 text-[11px] font-['DM_Sans'] text-[#888896]">
        <span className="absolute left-0">£{startPrice}</span>
        <span className="absolute right-0">£{buyNowPrice}</span>
      </div>
    </div>
  );
}
// ─── SellerView ───────────────────────────────────────────────────────────────
function SellerView({
  auction,
  dispatch,
  onPublish,
  role,
  onRoleChange,
}: {
  auction: AuctionState;
  dispatch: React.Dispatch<Action>;
  onPublish: () => void;
  role: "seller" | "buyer";
  onRoleChange: (r: "seller" | "buyer") => void;
}) {
  const [startStr, setStartStr] = useState("");
  const [buyNowStr, setBuyNowStr] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");

  const start = parseInt(startStr) || 0;
  const buyNow = parseInt(buyNowStr) || 0;

  function validate() {
    const errs: Record<string, string> = {};
    if (!startStr || start <= 0) errs.start = "Must be a positive whole-pound value";
    if (!buyNowStr || buyNow <= 0) errs.buyNow = "Must be a positive whole-pound value";
    if (start > 0 && buyNow > 0 && start >= buyNow)
      errs.start = "Starting bid must be less than Buy Now price";
    return errs;
  }

  function handlePublish() {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    dispatch({ type: "PUBLISH", start, buyNow });
    setToast("Auction published! Redirecting to market…");
    setTimeout(() => {
      setToast("");
      onPublish();
    }, 1200);
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <FleekNav role={role} onRoleChange={onRoleChange} />
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#0c0c0f] text-white text-[13px] font-['DM_Sans'] px-5 py-3 rounded-xl shadow-xl">
          {toast}
        </div>
      )}
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        {/* Header */}
        <p className="text-[12px] font-extrabold font-['Manrope'] text-[#74736e] tracking-[1.1px] mb-1">
          SELLER TOOLS · AUCTION SETUP
        </p>
        <h1
          className="text-[34px] font-extrabold tracking-[-1.8px] text-[#151515] leading-tight"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          Create an auction
        </h1>
        <p className="text-[15px] font-['Manrope'] text-[#6d6c67] mt-1 mb-8">
          Set your prices once. Buyers can bid or buy instantly while you're away.
        </p>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Lot + Market Guidance */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Lot card */}
            <div className="bg-white rounded-[16px] border border-[#e5e7eb] shadow-sm p-6">
              <div className="flex gap-4">
                <div className="w-[116px] h-[100px] shrink-0 rounded-lg overflow-hidden bg-[#f3f4f6]">
                  <img
                    src={productImg}
                    alt="50-piece Grade AB Branded Sweatshirt Lot"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <h2
                    className="text-[19px] font-extrabold tracking-[-0.8px] text-[#151515] leading-snug"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    50-piece Grade AB Branded Sweatshirt Lot
                  </h2>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {["Exact bundle", "Grade AB", "50 pieces"].map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] font-extrabold font-['Manrope'] text-[#151515] bg-[#fbfbfa] border border-[#e4e3de] px-2.5 py-1 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-[12px] font-['Manrope'] text-[#777670] mt-2">
                    £48 fixed shipping · Images show the exact lot
                  </p>
                </div>
              </div>
              {/* Market guidance */}
              <div className="mt-5 bg-[#fff7ce] rounded-[18px] border border-[#ead46b] p-5">
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <h3
                      className="text-[17px] font-extrabold tracking-[-0.55px] text-[#151515]"
                      style={{ fontFamily: "'Manrope', sans-serif" }}
                    >
                      Market guidance
                    </h3>
                    <p className="text-[13px] font-['Manrope'] text-[#716a4c]">
                      Comparable completed lots
                    </p>
                  </div>
                  <p className="text-[10px] font-extrabold font-['Manrope'] text-[#725c06] tracking-[0.3px]">
                    SYNTHETIC DEMO DATA · 12 SALES
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "LOW", value: "£560" },
                    { label: "MEDIAN", value: "£640" },
                    { label: "HIGH", value: "£720" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="bg-white/70 rounded-[18px] p-3"
                    >
                      <p className="text-[10px] font-extrabold font-['Manrope'] text-[#777263] tracking-[0.7px]">
                        {stat.label}
                      </p>
                      <p
                        className="text-[20px] font-extrabold tracking-[-0.8px] text-[#151515] mt-0.5"
                        style={{ fontFamily: "'Manrope', sans-serif" }}
                      >
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Review sidebar */}
          <div className="lg:w-[400px] shrink-0">
            <div className="bg-white rounded-[16px] border border-[#deddd7] shadow-[0_16px_15px_rgba(24,24,21,0.05)] p-6 sticky top-20">
              <p className="text-[12px] font-extrabold font-['Manrope'] text-[#74736e] tracking-[1.1px] mb-1">
                REVIEW
              </p>
              <h2
                className="text-[18px] font-extrabold tracking-[-0.65px] text-[#151515] mb-4"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Your auction rules
              </h2>

              <div className="space-y-4">
                <PriceInput
                  label="Starting bid"
                  value={startStr}
                  onChange={setStartStr}
                  badge="public"
                  error={errors.start}
                />
                <PriceInput
                  label="Buy Now price"
                  value={buyNowStr}
                  onChange={setBuyNowStr}
                  badge="public"
                  error={errors.buyNow}
                />
                {/* Duration - fixed */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] font-extrabold font-['Manrope'] text-[#151515]">
                      Duration
                    </label>
                    <PublicBadge />
                  </div>
                  <div className="relative">
                    <div className="w-full h-[48px] rounded-[18px] border border-[#d7d6d0] bg-white flex items-center justify-between px-3.5">
                      <span className="text-[14px] font-extrabold font-['Manrope'] text-[#151515]">
                        90 seconds (demo)
                      </span>
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                        <path d="M4.5 6.75L9 11.25L13.5 6.75" stroke="#151515" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Price range bar */}
              <div className="mt-5">
                <PriceRangeBar
                  startPrice={start}
                  buyNowPrice={buyNow > 0 ? buyNow : 0}
                />
              </div>

              {/* Publish */}
              <button
                onClick={handlePublish}
                className="w-full h-[44px] rounded-[12px] bg-[#fdc700] text-[#0c0c0f] text-[13px] font-semibold font-['DM_Sans'] flex items-center justify-center gap-2 hover:bg-[#e6b300] transition-colors active:scale-[0.98]"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                  <circle cx="9" cy="9" r="7.5" stroke="#0C0C0F" strokeWidth="1.5"/>
                  <path d="M12 6H7.5C7.10218 6 6.72064 6.15804 6.43934 6.43934C6.15804 6.72064 6 7.10218 6 7.5C6 7.89782 6.15804 8.27936 6.43934 8.56066C6.72064 8.84196 7.10218 9 7.5 9H10.5C10.8978 9 11.2794 9.15804 11.5607 9.43934C11.842 9.72064 12 10.1022 12 10.5C12 10.8978 11.842 11.2794 11.5607 11.5607C11.2794 11.842 10.8978 12 10.5 12H6" stroke="#0C0C0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 13.5V4.5" stroke="#0C0C0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Publish auction
              </button>

              <p className="text-[10px] font-['Manrope'] text-[#6d6c67] mt-3 leading-[1.6]">
                Net estimate uses the demo's 15% Fleek service-fee assumption. Shipping excluded.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MarketView ───────────────────────────────────────────────────────────────
function MarketAuctionCard({
  auction,
  onView,
}: {
  auction: AuctionState;
  onView: () => void;
}) {
  const { h, m, s } = formatCountdown(auction.secondsRemaining);
  const countdown =
    auction.status === "live"
      ? `${m}m ${s}s`
      : auction.status === "closed"
      ? "Closed"
      : "Not started";

  return (
    <div className="bg-white rounded-[16px] border border-[#e5e7eb] shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Image area */}
      <div className="bg-[#f5f5f0] h-[180px] flex items-center justify-center p-4">
        <img
          src={productImg}
          alt="50-piece Grade AB Branded Sweatshirt Lot"
          className="h-full w-full object-contain mix-blend-multiply"
        />
      </div>
      {/* Content */}
      <div className="p-5">
        <h3
          className="text-[15px] font-extrabold tracking-[-0.3px] text-[#151515] leading-snug mb-1"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          50-piece Grade AB Branded Sweatshirt Lot
        </h3>
        <p className="text-[12px] font-['Manrope'] text-[#777670] mb-3">
          Exact bundle · Grade AB · 50 pcs
        </p>
        <div className="mb-2">
          <p className="text-[10px] font-extrabold font-['Manrope'] text-[#77776f] tracking-[0.5px]">
            CURRENT BID
          </p>
          <p
            className="text-[28px] font-extrabold tracking-[-1px] text-[#151515] leading-none mt-0.5"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            £{auction.currentPrice}
          </p>
        </div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <StatusBadge status={auction.status} />
          {/* status only */}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-['Manrope'] text-[#6d6c67]">
              Buy Now £{auction.buyNowPrice}
            </p>
            <p className="text-[11px] font-['Manrope'] text-[#99a1af]">
              {auction.bidCount} bids ·{" "}
              {auction.status === "live" ? `${countdown} left` : countdown}
            </p>
          </div>
          <button
            onClick={onView}
            className="bg-white border border-[#d1d5dc] text-[#0c0c0f] text-[12px] font-semibold font-['DM_Sans'] px-4 py-2 rounded-[10px] hover:bg-gray-50 transition-colors"
          >
            View auction
          </button>
        </div>
      </div>
    </div>
  );
}

function StaticDemoCard({
  title,
  type,
  currentBid,
  buyNow,
  imageUrl,
  piecesLabel,
  supplier,
  endsIn = "2h",
}: {
  title: string;
  type: string;
  currentBid: number;
  buyNow: number;
  imageUrl: string;
  piecesLabel: string;
  supplier: string;
  endsIn?: string;
}) {
  return (
    <div className="bg-white rounded-[16px] border border-[#e5e7eb] shadow-sm overflow-hidden">
      <div className="h-[180px] bg-[#f5f5f0] overflow-hidden">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      </div>
      <div className="p-5">
        <p className="text-[10px] font-extrabold font-['Manrope'] text-[#77776f] tracking-[0.5px] mb-1">
          {piecesLabel}
        </p>
        <h3
          className="text-[15px] font-extrabold tracking-[-0.3px] text-[#151515] leading-snug mb-1"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          {title}
        </h3>
        <p className="text-[12px] font-['Manrope'] text-[#777670] mb-3">{type}</p>
        <div className="mb-2">
          <p className="text-[10px] font-extrabold font-['Manrope'] text-[#77776f] tracking-[0.5px]">
            CURRENT BID
          </p>
          <p
            className="text-[28px] font-extrabold tracking-[-1px] text-[#151515] leading-none mt-0.5"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            £{currentBid}
          </p>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 bg-[#dcfce7] text-[#15803d] text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-[#15803d]" />
            LIVE AUCTION
          </span>
        </div>
        <p className="text-[12px] font-['Manrope'] text-[#6d6c67]">
          Buy Now £{buyNow} · Ends in {endsIn}
        </p>
        <p className="text-[10px] font-['Manrope'] text-[#99a1af] mt-0.5">{supplier}</p>
      </div>
    </div>
  );
}

function MarketView({
  auction,
  onView,
  onCreateAuction,
  role,
  onRoleChange,
}: {
  auction: AuctionState;
  onView: () => void;
  onCreateAuction: () => void;
  role: "seller" | "buyer";
  onRoleChange: (r: "seller" | "buyer") => void;
}) {
  const [activeFilter, setActiveFilter] = useState("All auctions");
  const filters = ["All auctions", "Exact bundles", "Ending soon"];

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <FleekNav role={role} onRoleChange={onRoleChange} />
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[12px] font-extrabold font-['Manrope'] text-[#74736e] tracking-[1.1px] mb-1">
              ALWAYS-ON MARKET
            </p>
            <h1
              className="text-[34px] font-extrabold tracking-[-1.8px] text-[#151515] leading-tight"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Auction House
            </h1>
            <p className="text-[15px] font-['Manrope'] text-[#6d6c67] mt-1">
              {role === "seller" ? "Manage and list your wholesale inventory." : "Bid and wait, or buy now."}
            </p>
          </div>
          {role === "seller" && (
            <button
              onClick={onCreateAuction}
              className="shrink-0 flex items-center gap-2 bg-[#fdc700] text-[#0c0c0f] text-[14px] font-semibold font-['DM_Sans'] px-5 py-2.5 rounded-[12px] hover:bg-[#e6b300] transition-colors active:scale-[0.98] shadow-sm mt-2"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
                <path d="M7.5 2.5v10M2.5 7.5h10" stroke="#0c0c0f" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Create auction
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-8 mt-4 flex-wrap">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`text-[13px] font-semibold font-['DM_Sans'] px-4 py-2 rounded-full transition-colors ${
                activeFilter === f
                  ? "bg-[#0c0c0f] text-white"
                  : "bg-white border border-[#d1d5dc] text-[#4a5565] hover:bg-gray-50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {auction.status !== "draft" && (
            <MarketAuctionCard auction={auction} onView={onView} />
          )}
          <StaticDemoCard
            title="Lacoste Collar T-Shirts"
            type="Exact bundle · Grade AB · 10 pcs · S–XXL"
            currentBid={95}
            buyNow={135}
            imageUrl="https://d2io9vrujy7b7u.cloudfront.net/fit-in/450x450/filters:strip_exif()/9386758177006/f2f1ba55-a7af-4c5f-9ce4-d415d365c7ef/rn_image_picker_lib_temp_d85dce37-54e3-4478-854a-1005b89fea55.jpg"
            piecesLabel="LACOSTE · MENSWEAR · GRADE AB"
            supplier="House of Wears"
            endsIn="1h 45m"
          />
          <StaticDemoCard
            title="Lacoste T-Shirts"
            type="Representative · Grade AB · 20 pcs · S–XXL"
            currentBid={160}
            buyNow={220}
            imageUrl="https://images.unsplash.com/photo-1560454324-5d6b93fcde0a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600"
            piecesLabel="LACOSTE · MENSWEAR · GRADE AB"
            supplier="Trendy Treasures"
            endsIn="3h 20m"
          />
        </div>
      </div>
    </div>
  );
}

// ─── BuyerView ────────────────────────────────────────────────────────────────
function BuyerView({
  auction,
  dispatch,
  role,
  onRoleChange,
}: {
  auction: AuctionState;
  dispatch: React.Dispatch<Action>;
  role: "seller" | "buyer";
  onRoleChange: (r: "seller" | "buyer") => void;
}) {
  const [buyerTab, setBuyerTab] = useState<BuyerTab>("buy-now");
  const [activityTab, setActivityTab] = useState<ActivityTab>("public");
  const [maxStr, setMaxStr] = useState("690");
  const [toast, setToast] = useState("");
  // "idle" | "outbid" | "confirmed" | "dismissed"
  const [outbidState, setOutbidState] = useState<"idle" | "outbid" | "confirmed" | "dismissed">("idle");
  const outbidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const RIVAL_MAX = 710;
  const REBID_AMOUNT = 780;

  const { h, m, s } = formatCountdown(auction.secondsRemaining);
  const isClosed = auction.status === "closed";
  const isLive = auction.status === "live";
  const proxyActive = auction.primaryMaximum !== null;
  const isLeading = auction.leader === "primary";
  const isOutbid = proxyActive && !isLeading && auction.leader !== "none" && auction.leader !== "buy-now";

  // Start 10-second outbid timer when proxy first activates
  useEffect(() => {
    if (proxyActive && isLive && outbidState === "idle") {
      outbidTimerRef.current = setTimeout(() => {
        dispatch({ type: "RIVAL_BID", rivalMax: RIVAL_MAX });
        setOutbidState("outbid");
        setBuyerTab("place-bid");
      }, 10000);
    }
    return () => {
      if (outbidTimerRef.current) clearTimeout(outbidTimerRef.current);
    };
  }, [proxyActive, isLive, outbidState]);

  const handleRebid = useCallback(() => {
    dispatch({ type: "APPROVE_PRIMARY", max: REBID_AMOUNT });
    setMaxStr(String(REBID_AMOUNT));
    setOutbidState("confirmed");
    dismissTimerRef.current = setTimeout(() => setOutbidState("dismissed"), 3500);
  }, [dispatch]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function handleApproveMax() {
    if (!isLive) return;
    const max = parseInt(maxStr);
    if (!max || max <= 0) return showToast("Enter a valid maximum bid");
    if (max >= auction.buyNowPrice) return showToast("Your maximum meets the Buy Now price. Click Buy Now instead.");
    if (auction.primaryMaximum !== null && max <= auction.primaryMaximum)
      return showToast(`Maximum must be greater than your current maximum of £${auction.primaryMaximum}`);
    dispatch({ type: "APPROVE_PRIMARY", max });
    showToast(`Proxy activated at £${max}. Bidding automatically on your behalf.`);
  }

  function handleBuyNow() {
    if (!isLive) return;
    dispatch({ type: "BUY_NOW" });
    showToast("You've purchased at Buy Now · Pending Fleek QC");
  }

  const proxyStatus = !proxyActive
    ? null
    : isClosed
    ? "Proxy stopped · Auction closed"
    : isLeading
    ? "Proxy active · You're leading"
    : "Proxy stopped · You've been outbid";

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <FleekNav role={role} onRoleChange={onRoleChange} />
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#0c0c0f] text-white text-[13px] font-['DM_Sans'] px-5 py-3 rounded-xl shadow-xl max-w-sm text-center">
          {toast}
        </div>
      )}

      {/* Outbid notification */}
      <AnimatePresence>
        {(outbidState === "outbid" || outbidState === "confirmed") && (
          <motion.div
            key="outbid-banner"
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="fixed top-[68px] left-0 right-0 z-40 flex justify-center px-4"
          >
            <motion.div
              layout
              className={`w-full max-w-[560px] rounded-[14px] shadow-xl border overflow-hidden ${
                outbidState === "confirmed"
                  ? "bg-[#dcfce7] border-[#86efac]"
                  : "bg-[#0c0c0f] border-[#27272a]"
              }`}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <AnimatePresence mode="wait">
                  {outbidState === "outbid" ? (
                    <motion.div
                      key="outbid-content"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-4 flex-1 min-w-0"
                    >
                      {/* Pulse dot */}
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-[13px] font-semibold font-['DM_Sans'] leading-snug">
                          You were outbid by Buyer X — new highest bid <span className="text-[#fdc700]">£{RIVAL_MAX - 10 + 10}</span>
                        </p>
                        <p className="text-[#888896] text-[11px] font-['DM_Sans'] mt-0.5">
                          Pricing intelligence suggests re-bidding at £{REBID_AMOUNT} to regain the lead.
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="confirmed-content"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0" aria-hidden>
                        <circle cx="10" cy="10" r="9" fill="#15803d"/>
                        <path d="M6.5 10L8.5 12L13.5 7.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <p className="text-[#14532d] text-[13px] font-semibold font-['DM_Sans']">
                        You're now the highest bidder at £{REBID_AMOUNT} — proxy is active.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {outbidState === "outbid" && (
                  <motion.button
                    layout
                    onClick={handleRebid}
                    whileTap={{ scale: 0.96 }}
                    className="shrink-0 bg-[#fdc700] text-[#0c0c0f] text-[13px] font-semibold font-['DM_Sans'] px-4 py-2 rounded-[10px] hover:bg-[#e6b300] transition-colors whitespace-nowrap"
                  >
                    Re-bid £{REBID_AMOUNT}
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1280px] mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Product detail */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Product images + info */}
            <div className="bg-white rounded-[16px] border border-[#e5e7eb] shadow-sm overflow-hidden">
              <div className="bg-[#f5f5f0] p-8 flex items-center justify-center gap-4">
                <div className="flex items-center gap-3">
                  <StatusBadge status={auction.status} />
                  <span className="text-[12px] font-['Manrope'] text-[#6d6c67]">Like New</span>
                </div>
              </div>
              <div className="bg-[#f5f5f0] flex items-center justify-center pb-6 gap-6">
                <img
                  src={productImg}
                  alt="50-piece Grade AB Branded Sweatshirt Lot"
                  className="h-[200px] object-contain"
                />
              </div>
              <div className="p-6">
                <h1
                  className="text-[22px] font-extrabold tracking-[-0.8px] text-[#151515] leading-snug mb-1"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  UPCYCLE NEW CARHARTT JACKET STYLE
                </h1>
                <p
                  className="text-[17px] font-extrabold tracking-[-0.5px] text-[#151515]"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  50-piece Grade AB Branded Sweatshirt Lot
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-3 text-[12px] font-['Manrope'] text-[#4a5565]">
                  <span className="flex items-center gap-1.5">👁 1,847 views</span>
                  <span className="flex items-center gap-1.5">⚡ 142 watching</span>
                  <span className="flex items-center gap-1.5">🔨 {auction.bidCount} bids</span>
                </div>
              </div>
            </div>

            {/* Lot details */}
            <div className="bg-white rounded-[16px] border border-[#e5e7eb] shadow-sm p-6">
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "EXACT BUNDLE", value: "Yes" },
                  { label: "GRADE", value: "AB" },
                  { label: "QTY PIECES", value: "50" },
                  { label: "BRANDS", value: "Mixed" },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <p
                      className="text-[15px] font-extrabold text-[#151515]"
                      style={{ fontFamily: "'Manrope', sans-serif" }}
                    >
                      {item.value}
                    </p>
                    <p className="text-[10px] font-bold font-['Manrope'] text-[#77776f] tracking-[0.5px] mt-0.5">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Supplier */}
            <div className="bg-white rounded-[16px] border border-[#e5e7eb] shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#fdc700] flex items-center justify-center text-[#0c0c0f] font-bold text-[14px] font-['Manrope']">
                    TK
                  </div>
                  <div>
                    <p className="text-[14px] font-extrabold font-['Manrope'] text-[#151515]">
                      Thrift Kings Wholesale
                    </p>
                    <p className="text-[12px] font-['Manrope'] text-[#77776f]">
                      ★ 4.8 · Verified supplier · 312 orders
                    </p>
                  </div>
                </div>
                <button className="text-[13px] font-semibold font-['DM_Sans'] text-[#4a5565] border border-[#d1d5dc] px-4 py-1.5 rounded-[10px] hover:bg-gray-50 transition-colors">
                  View seller
                </button>
              </div>
            </div>
          </div>

          {/* Right: Auction panel */}
          <div className="lg:w-[380px] shrink-0">
            <div className="bg-white rounded-[16px] border border-[#e5e7eb] shadow-sm p-5 sticky top-20 space-y-4">
              {/* Countdown */}
              <div>
                <p className="text-[12px] font-['Manrope'] text-[#6d6c67] mb-2 flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${isLive ? "bg-[#fdc700] animate-pulse" : "bg-[#d1d5dc]"}`}
                  />
                  {isClosed ? "Auction ended" : "Auction ends in"}
                </p>
                {!isClosed && (
                  <div className="flex items-center gap-2">
                    {[
                      { value: h, label: "HRS" },
                      { value: m, label: "MIN" },
                      { value: s, label: "SEC" },
                    ].map((unit, i) => (
                      <div key={unit.label} className="flex items-center gap-2">
                        {i > 0 && (
                          <span className="text-[20px] font-extrabold text-[#151515] font-['Manrope']">
                            :
                          </span>
                        )}
                        <div className="text-center">
                          <p
                            className="text-[28px] font-extrabold tracking-tight text-[#151515] leading-none"
                            style={{ fontFamily: "'Manrope', sans-serif" }}
                          >
                            {unit.value}
                          </p>
                          <p className="text-[9px] font-bold font-['Manrope'] text-[#99a1af] tracking-[1px]">
                            {unit.label}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {isClosed && auction.fulfilment && <FulfilmentBadge />}
                {isClosed && !auction.fulfilment && (
                  <div className="bg-[#fef2f2] border border-[#fecaca] rounded-xl px-4 py-3">
                    <p className="text-[#dc2626] text-[12px] font-extrabold font-['Manrope']">
                      Auction ended · Reserve not met
                    </p>
                  </div>
                )}
              </div>

              {/* Bid count */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12px] font-['Manrope'] text-[#6d6c67]">
                  {auction.bidCount} bids
                </span>
              </div>

              {/* Tabs */}
              <div className="flex rounded-[12px] bg-[#f3f4f6] p-1 gap-1">
                {(["buy-now", "place-bid"] as BuyerTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => !isClosed && setBuyerTab(tab)}
                    disabled={isClosed}
                    className={`flex-1 py-2 text-[13px] font-semibold font-['DM_Sans'] rounded-[10px] transition-colors ${
                      buyerTab === tab
                        ? tab === "buy-now"
                          ? "bg-[#fdc700] text-[#0c0c0f]"
                          : "bg-[#0c0c0f] text-white"
                        : "text-[#4a5565] hover:bg-white/60"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {tab === "buy-now" ? "Buy Now" : "Place Bid"}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {buyerTab === "buy-now" && (
                <div className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[11px] font-extrabold font-['Manrope'] text-[#77776f] tracking-[0.5px]">
                        CURRENT BID
                      </p>
                      <p
                        className="text-[36px] font-extrabold tracking-[-1.5px] text-[#151515] leading-none"
                        style={{ fontFamily: "'Manrope', sans-serif" }}
                      >
                        £{auction.currentPrice}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-extrabold font-['Manrope'] text-[#77776f] tracking-[0.5px]">
                        BUY NOW PRICE
                      </p>
                      <p
                        className="text-[36px] font-extrabold tracking-[-1.5px] text-[#151515] leading-none"
                        style={{ fontFamily: "'Manrope', sans-serif" }}
                      >
                        £{auction.buyNowPrice}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleBuyNow}
                    disabled={isClosed}
                    className="w-full h-[48px] rounded-[12px] bg-[#fdc700] text-[#0c0c0f] text-[14px] font-semibold font-['DM_Sans'] flex items-center justify-center gap-2 hover:bg-[#e6b300] transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    ⚡ Buy Now £{auction.buyNowPrice}
                  </button>
                  {isClosed && (
                    <p className="text-[11px] font-['Manrope'] text-[#99a1af] text-center">
                      Bidding is closed
                    </p>
                  )}
                </div>
              )}

              {buyerTab === "place-bid" && (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-extrabold font-['Manrope'] text-[#77776f] tracking-[0.5px] mb-1">
                      {proxyActive ? "CURRENT PRICE" : "STARTING BID"}
                    </p>
                    <p
                      className="text-[36px] font-extrabold tracking-[-1.5px] text-[#151515] leading-none"
                      style={{ fontFamily: "'Manrope', sans-serif" }}
                    >
                      £{auction.currentPrice}
                    </p>
                  </div>

                  {/* Proxy status */}
                  {proxyActive && (
                    <div
                      className={`rounded-xl px-4 py-3 ${
                        isClosed
                          ? "bg-[#f1f5f9] border border-[#e2e8f0]"
                          : isLeading
                          ? "bg-[#dcfce7] border border-[#86efac]"
                          : "bg-[#fef3c7] border border-[#fde68a]"
                      }`}
                    >
                      <p
                        className={`text-[12px] font-extrabold font-['Manrope'] ${
                          isClosed ? "text-[#64748b]" : isLeading ? "text-[#15803d]" : "text-[#92400e]"
                        }`}
                      >
                        {proxyStatus}
                      </p>
                      <p className="text-[11px] font-['Manrope'] text-[#6d6c67] mt-0.5">
                        Your maximum: £{auction.primaryMaximum} <PrivateBadge />
                      </p>
                    </div>
                  )}

                  {/* Max bid input */}
                  <div>
                    <label className="text-[13px] font-extrabold font-['Manrope'] text-[#171717] block mb-1.5">
                      {proxyActive ? "Update your maximum bid" : "Set your maximum bid"}
                    </label>
                    <p className="text-[11px] font-['Manrope'] text-[#6d6c67] mb-2">
                      The proxy bids only as much as needed to keep you leading. Your maximum stays private.
                    </p>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[16px] font-extrabold font-['Manrope'] text-[#151515] pointer-events-none">
                        £
                      </span>
                      <input
                        type="number"
                        min="1"
                        step="10"
                        value={maxStr}
                        onChange={(e) => setMaxStr(e.target.value)}
                        disabled={isClosed}
                        className="w-full h-[48px] rounded-[18px] border border-[#d7d6d0] pl-7 pr-3 text-[16px] font-extrabold font-['Manrope'] text-[#151515] bg-white outline-none focus:border-[#fdc700] transition-colors disabled:opacity-50"
                      />
                    </div>
                    {/* Slider — matches seller price range bar */}
                    <div className="mt-3">
                      <BidSlider
                        startPrice={auction.startPrice}
                        buyNowPrice={auction.buyNowPrice}
                        value={parseInt(maxStr) || auction.startPrice}
                        onChange={(v) => setMaxStr(String(v))}
                        disabled={isClosed}
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleApproveMax}
                    disabled={isClosed}
                    className="w-full h-[48px] rounded-[12px] bg-[#0c0c0f] text-white text-[14px] font-semibold font-['DM_Sans'] flex items-center justify-center gap-2 hover:bg-[#1a1a1f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    🤖 {proxyActive ? "Update agent" : "Approve maximum & start proxy"}
                  </button>

                  {auction.status === "draft" && (
                    <p className="text-[11px] font-['Manrope'] text-[#92400e] text-center bg-[#fef3c7] rounded-lg py-2 px-3">
                      The auction is not live yet. Publish it from the Seller view first.
                    </p>
                  )}
                </div>
              )}

              {/* Activity feed */}
              <div className="border-t border-[#e5e7eb] pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[13px] font-extrabold font-['Manrope'] text-[#151515]">
                    Bid Activity
                  </h4>
                  <span className="text-[12px] font-['Manrope'] text-[#6d6c67]">
                    {auction.bidCount} total bids
                  </span>
                </div>
                {/* Activity tabs */}
                <div className="flex gap-1 mb-3">
                  {(["public", "private"] as ActivityTab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActivityTab(tab)}
                      className={`text-[12px] font-semibold font-['DM_Sans'] px-3 py-1 rounded-full transition-colors ${
                        activityTab === tab
                          ? "bg-[#0c0c0f] text-white"
                          : "text-[#4a5565] hover:bg-gray-100"
                      }`}
                    >
                      {tab === "public" ? "Public" : "Private to you"}
                    </button>
                  ))}
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {activityTab === "public" ? (
                    auction.publicEvents.length === 0 ? (
                      <p className="text-[12px] font-['Manrope'] text-[#99a1af]">
                        No public activity yet.
                      </p>
                    ) : (
                      [...auction.publicEvents].reverse().map((ev, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-[#f3f4f6] flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-[10px]">🔨</span>
                          </div>
                          <p className="text-[12px] font-['Manrope'] text-[#4a5565]">{ev}</p>
                        </div>
                      ))
                    )
                  ) : auction.privateBuyerEvents.length === 0 ? (
                    <p className="text-[12px] font-['Manrope'] text-[#99a1af]">
                      No private activity yet.
                    </p>
                  ) : (
                    [...auction.privateBuyerEvents].reverse().map((ev, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-[#efecff] flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[10px]">🔒</span>
                        </div>
                        <p className="text-[12px] font-['Manrope'] text-[#4a5565]">{ev}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Demo Controls ────────────────────────────────────────────────────────────
function DemoControls({
  auction,
  dispatch,
  currentView,
  setView,
}: {
  auction: AuctionState;
  dispatch: React.Dispatch<Action>;
  currentView: View;
  setView: (v: View) => void;
}) {
  const [open, setOpen] = useState(true);
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  }

  function runBaseline() {
    if (auction.status !== "live") return showToast("Publish the auction first");
    if (auction.primaryMaximum === null) {
      dispatch({ type: "APPROVE_PRIMARY", max: 690 });
    }
    setTimeout(() => {
      dispatch({ type: "RIVAL_BID", rivalMax: 650 });
      showToast("Baseline path: rival £650 → primary leads at £660");
    }, 100);
  }

  function runAlternate() {
    if (auction.status !== "live") return showToast("Publish the auction first");
    if (auction.primaryMaximum === null) {
      dispatch({ type: "APPROVE_PRIMARY", max: 690 });
    }
    setTimeout(() => {
      dispatch({ type: "RIVAL_BID", rivalMax: 710 });
      showToast("Alternate path: rival £710 → rival leads at £700");
    }, 100);
  }

  function runInstant() {
    if (auction.status !== "live") return showToast("Publish the auction first");
    dispatch({ type: "BUY_NOW" });
    showToast("Buy Now triggered → closed at £760");
  }

  function advanceClose() {
    if (auction.status !== "live") return showToast("Auction is not live");
    dispatch({ type: "ADVANCE_CLOSE" });
    showToast("Auction advanced to close");
  }

  function replay() {
    dispatch({ type: "REPLAY" });
    setView("market");
    showToast("Replayed to published £" + auction.startPrice + " state");
  }

  function reset() {
    dispatch({ type: "RESET" });
    setView("seller");
    showToast("Reset to seller setup");
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-[340px] w-full">
      {toast && (
        <div className="mb-2 bg-[#0c0c0f] text-white text-[12px] font-['DM_Sans'] px-4 py-2 rounded-xl shadow-xl text-center">
          {toast}
        </div>
      )}
      <div className="bg-white rounded-[16px] border-2 border-[#fdc700] shadow-2xl overflow-hidden">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#0c0c0f] text-white"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold font-['Manrope'] bg-[#fdc700] text-[#0c0c0f] px-2 py-0.5 rounded-full tracking-wide">
              PROTOTYPE
            </span>
            <span className="text-[13px] font-semibold font-['DM_Sans']">Interactive prototype</span>
          </div>
          <span className="text-[#fdc700] text-[16px]">{open ? "▾" : "▸"}</span>
        </button>

        {open && (
          <div className="p-4 space-y-3">
            {/* State display */}
            <div className="bg-[#f3f4f6] rounded-[12px] px-3 py-2.5 space-y-1 text-[11px] font-['Manrope']">
              <div className="flex justify-between">
                <span className="text-[#6d6c67]">Status</span>
                <span className="font-bold text-[#151515]">{auction.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6d6c67]">Current price</span>
                <span className="font-bold text-[#151515]">£{auction.currentPrice}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6d6c67]">Leader</span>
                <span className="font-bold text-[#151515]">{auction.leader}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6d6c67]">Primary max</span>
                <span className="font-bold text-[#151515]">
                  {auction.primaryMaximum ? `£${auction.primaryMaximum}` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6d6c67]">Rival max (simulated)</span>
                <span className="font-bold text-[#151515]">
                  {auction.rivalMaximum ? `£${auction.rivalMaximum}` : "—"}
                </span>
              </div>

            </div>

            {/* View switcher */}
            <div>
              <p className="text-[10px] font-bold font-['Manrope'] text-[#77776f] tracking-[0.5px] mb-1.5">
                VIEW
              </p>
              <div className="flex gap-1">
                {(["seller", "market", "buyer"] as View[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`flex-1 py-1.5 text-[11px] font-semibold font-['DM_Sans'] rounded-[8px] capitalize transition-colors ${
                      currentView === v
                        ? "bg-[#0c0c0f] text-white"
                        : "bg-[#f3f4f6] text-[#4a5565] hover:bg-gray-200"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Scenario buttons */}
            <div>
              <p className="text-[10px] font-bold font-['Manrope'] text-[#77776f] tracking-[0.5px] mb-1.5">
                SIMULATED RIVAL
              </p>
              <div className="space-y-1.5">
                <button
                  onClick={runBaseline}
                  disabled={auction.status !== "live"}
                  className="w-full text-left px-3 py-2 rounded-[10px] bg-[#f0fdf4] border border-[#86efac] text-[12px] font-semibold font-['DM_Sans'] text-[#15803d] hover:bg-[#dcfce7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ↗ Baseline — rival max £650 → primary leads at £660
                </button>
                <button
                  onClick={runAlternate}
                  disabled={auction.status !== "live"}
                  className="w-full text-left px-3 py-2 rounded-[10px] bg-[#fef3c7] border border-[#fde68a] text-[12px] font-semibold font-['DM_Sans'] text-[#92400e] hover:bg-[#fef9c3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ↗ Alternate — rival max £710 → rival leads at £700
                </button>
                <button
                  onClick={runInstant}
                  disabled={auction.status !== "live"}
                  className="w-full text-left px-3 py-2 rounded-[10px] bg-[#eff6ff] border border-[#93c5fd] text-[12px] font-semibold font-['DM_Sans'] text-[#1d4ed8] hover:bg-[#dbeafe] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ⚡ Instant — Buy Now £760
                </button>
              </div>
            </div>

            {/* Control buttons */}
            <div>
              <p className="text-[10px] font-bold font-['Manrope'] text-[#77776f] tracking-[0.5px] mb-1.5">
                CONTROLS
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={advanceClose}
                  disabled={auction.status !== "live"}
                  className="py-2 text-[11px] font-semibold font-['DM_Sans'] rounded-[8px] bg-[#f3f4f6] text-[#4a5565] hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ⏭ Close
                </button>
                <button
                  onClick={replay}
                  className="py-2 text-[11px] font-semibold font-['DM_Sans'] rounded-[8px] bg-[#f3f4f6] text-[#4a5565] hover:bg-gray-200 transition-colors"
                >
                  ↺ Replay
                </button>
                <button
                  onClick={reset}
                  className="py-2 text-[11px] font-semibold font-['DM_Sans'] rounded-[8px] bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] hover:bg-[#fee2e2] transition-colors"
                >
                  ✕ Reset
                </button>
              </div>
            </div>

            <p className="text-[9px] font-['Manrope'] text-[#99a1af] text-center">
              Simulated rival · For demo only · Not customer-facing
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [auction, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [view, setView] = useState<View>("market");
  const [role, setRole] = useState<"seller" | "buyer">("seller");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer
  useEffect(() => {
    if (auction.status === "live") {
      timerRef.current = setInterval(() => {
        dispatch({ type: "TICK" });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [auction.status]);

  function handlePublish() {
    setRole("buyer");
    setView("market");
  }

  function handleViewAuction() {
    setView("buyer");
  }

  function handleCreateAuction() {
    setView("seller");
  }

  function handleRoleChange(r: "seller" | "buyer") {
    setRole(r);
    if (view === "buyer") setView("market");
  }

  return (
    <div className="min-h-screen">
      {view === "seller" && (
        <SellerView
          auction={auction}
          dispatch={dispatch}
          onPublish={handlePublish}
          role={role}
          onRoleChange={handleRoleChange}
        />
      )}
      {view === "market" && (
        <MarketView
          auction={auction}
          onView={handleViewAuction}
          onCreateAuction={handleCreateAuction}
          role={role}
          onRoleChange={handleRoleChange}
        />
      )}
      {view === "buyer" && (
        <BuyerView
          auction={auction}
          dispatch={dispatch}
          role={role}
          onRoleChange={handleRoleChange}
        />
      )}
      <DemoControls
        auction={auction}
        dispatch={dispatch}
        currentView={view}
        setView={setView}
      />
    </div>
  );
}
