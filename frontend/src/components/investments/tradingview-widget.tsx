"use client";

import { useEffect, useRef } from "react";

interface TradingViewWidgetProps {
  symbol: string;
  height?: number;
}

/**
 * Embeds TradingView's free Symbol Overview widget. The script tag must be
 * a direct child of an empty container, and the widget config is encoded
 * inside it as JSON — that's how TradingView's loader discovers it.
 *
 * Re-mounts only when `symbol` or `height` change. The widget always
 * uses dark mode since all Aegis cosmic themes share a dark surface.
 */
export function TradingViewWidget({ symbol, height = 220 }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [[symbol, symbol]],
      chartOnly: false,
      width: "100%",
      height,
      locale: "en",
      colorTheme: "dark",
      isTransparent: true,
      showVolume: false,
      showMA: false,
      hideDateRanges: false,
      hideMarketStatus: false,
      hideSymbolLogo: false,
      scalePosition: "right",
      scaleMode: "Normal",
      fontFamily: "system-ui, sans-serif",
      fontSize: "10",
      noTimeScale: false,
      valuesTracking: "1",
      changeMode: "price-and-percent",
      lineWidth: 2,
      lineType: 0,
      dateRanges: ["1m|30", "3m|60", "12m|1D", "60m|1W", "all|1M"],
    });

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol, height]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ height, width: "100%" }}
    />
  );
}
