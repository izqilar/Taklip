import type { CSSProperties } from 'react';
import type { CalendarElement } from '@h5design/core';
import {getCalendarGrid, WEEKDAYS_EN, WEEKDAYS_ZH, CalendarMarkerSvg, CALENDAR_PULSE_KEYFRAMES} from '@h5design/render';

interface DOMCalendarProps {
  el: CalendarElement;
  style: CSSProperties;
  dataAttrs?: Record<string, string>;
}

/** 发布态 DOM 渲染器 — 与编辑态 Konva 渲染共享同一布局算法，保证所见即所得。 */
export default function DOMCalendar({ el, style, dataAttrs }: DOMCalendarProps) {
  const {
    width,
    height,
    year,
    month,
    highlightDay,
    locale,
    marker,
    themeColor,
    dayColor,
    iconColor,
    textColor,
    bgColor,
    fontFamily,
    iconAnimation,
  } = el;

  const padding = Math.min(width, height) * 0.05;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const headerH = innerH * 0.22;
  const weekdayH = innerH * 0.1;
  const gridTop = headerH + weekdayH;
  const gridH = innerH - gridTop;
  const cellW = innerW / 7;
  const cellH = gridH / 6;

  const weekdays = locale === 'en' ? WEEKDAYS_EN : WEEKDAYS_ZH;
  const grid = getCalendarGrid(year, month);
  const dayLabel = String(highlightDay).padStart(2, '0');
  const ff = fontFamily || 'Microsoft YaHei, PingFang SC, sans-serif';

  const containerStyle: CSSProperties = {
    ...style,
    background: bgColor || '#ffffff',
    overflow: 'hidden',
  };

  return (
    <>
      <style>{CALENDAR_PULSE_KEYFRAMES}</style>
      <div {...dataAttrs} style={containerStyle}>
        {/* 顶部标题区 */}
        <div style={{ position: 'absolute', left: padding, top: padding, right: padding, height: headerH }}>
          <span
            style={{
              position: 'absolute',
              left: 0,
              top: headerH * 0.1,
              fontSize: headerH * 0.55,
              fontWeight: 700,
              color: themeColor,
              fontFamily: ff,
            }}
          >{`${month} / ${dayLabel}`}</span>
          <span
            style={{
              position: 'absolute',
              right: 0,
              top: headerH * 0.15,
              width: innerW,
              textAlign: 'right',
              fontSize: headerH * 0.5,
              fontWeight: 700,
              color: themeColor,
              fontFamily: ff,
            }}
          >{year}</span>
        </div>

        {/* 分隔线 */}
        <div
          style={{
            position: 'absolute',
            left: padding,
            top: padding + headerH,
            width: innerW,
            height: 1,
            background: themeColor,
            opacity: 0.4,
          }}
        />

        {/* 星期行 */}
        <div style={{ position: 'absolute', left: padding, top: padding + headerH, width: innerW, height: weekdayH }}>
          {weekdays.map((wd, i) => (
            <span
              key={wd}
              style={{
                position: 'absolute',
                left: i * cellW,
                top: 0,
                width: cellW,
                height: weekdayH,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: weekdayH * 0.45,
                fontFamily: ff,
                color: themeColor,
              }}
            >
              {wd}
            </span>
          ))}
        </div>

        {/* 日期网格 */}
        <div style={{ position: 'absolute', left: padding, top: padding + gridTop, width: innerW, height: gridH }}>
          {grid.map((cell, idx) => {
            const isHighlight = cell.isCurrentMonth && cell.day === highlightDay;
            const color = isHighlight ? textColor : cell.isCurrentMonth ? dayColor : '#d1d5db';
            const fontSize = Math.min(cellW, cellH) * 0.42;

            if (isHighlight) {
              const markerSize = Math.min(cellW, cellH) * 0.82;
              return (
                <div
                  key={idx}
                  style={{ position: 'absolute', left: cell.col * cellW, top: cell.row * cellH, width: cellW, height: cellH }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: (cellW - markerSize) / 2,
                      top: (cellH - markerSize) / 2,
                      width: markerSize,
                      height: markerSize,
                      transformOrigin: 'center',
                      animation: iconAnimation ? 'calendar-marker-pulse 1.4s ease-in-out infinite' : undefined,
                    }}
                  >
                    <CalendarMarkerSvg marker={marker} size={markerSize} color={iconColor} />
                  </div>
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: cellW,
                      height: cellH,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize,
                      fontWeight: 600,
                      fontFamily: ff,
                      color,
                    }}
                  >
                    {cell.day}
                  </span>
                </div>
              );
            }

            return (
              <span
                key={idx}
                style={{
                  position: 'absolute',
                  left: cell.col * cellW,
                  top: cell.row * cellH,
                  width: cellW,
                  height: cellH,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize,
                  fontFamily: ff,
                  color,
                }}
              >
                {cell.day}
              </span>
            );
          })}
        </div>
      </div>
    </>
  );
}
