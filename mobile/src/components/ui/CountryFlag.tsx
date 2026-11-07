import React from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

type Props = {
  iso: string;
  width?: number;
  height?: number;
  circle?: boolean;
};

export function CountryFlag({ iso, width = 24, height = 24, circle = true }: Props) {
  const code = iso.toUpperCase();
  const clipId = `flag-clip-${code.toLowerCase()}-${circle ? 'c' : 'r'}`;
  const r = Math.min(width, height) / 2;

  // Render inside 24x24 coordinate space
  switch (code) {
    case 'IN':
      return (
        <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
          <Defs>
            <ClipPath id={clipId}>
              {circle ? (
                <Circle cx="12" cy="12" r="12" />
              ) : (
                <Rect width="24" height="24" rx="4" />
              )}
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${clipId})`}>
            {/* Saffron */}
            <Rect width="24" height="8" fill="#FF9933" />
            {/* White */}
            <Rect y="8" width="24" height="8" fill="#FFFFFF" />
            {/* Green */}
            <Rect y="16" width="24" height="8" fill="#138808" />
            {/* Ashoka Chakra */}
            <Circle cx="12" cy="12" r="3.2" stroke="#000080" strokeWidth="0.7" fill="none" />
            <Circle cx="12" cy="12" r="0.8" fill="#000080" />
            <Path
              d="M12 9v6M9 12h6M9.9 9.9l4.2 4.2M9.9 14.1l4.2-4.2"
              stroke="#000080"
              strokeWidth="0.5"
            />
          </G>
          {circle ? (
            <Circle cx="12" cy="12" r="11.5" stroke="rgba(0,0,0,0.12)" strokeWidth="1" fill="none" />
          ) : (
            <Rect width="24" height="24" rx="4" stroke="rgba(0,0,0,0.12)" strokeWidth="1" fill="none" />
          )}
        </Svg>
      );

    case 'AE':
      return (
        <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
          <Defs>
            <ClipPath id={clipId}>
              {circle ? <Circle cx="12" cy="12" r="12" /> : <Rect width="24" height="24" rx="4" />}
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${clipId})`}>
            <Rect x="7" y="0" width="17" height="8" fill="#00732F" />
            <Rect x="7" y="8" width="17" height="8" fill="#FFFFFF" />
            <Rect x="7" y="16" width="17" height="8" fill="#000000" />
            <Rect x="0" y="0" width="7" height="24" fill="#FF0000" />
          </G>
          {circle ? (
            <Circle cx="12" cy="12" r="11.5" stroke="rgba(0,0,0,0.12)" strokeWidth="1" fill="none" />
          ) : (
            <Rect width="24" height="24" rx="4" stroke="rgba(0,0,0,0.12)" strokeWidth="1" fill="none" />
          )}
        </Svg>
      );

    case 'SA':
      return (
        <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
          <Defs>
            <ClipPath id={clipId}>
              {circle ? <Circle cx="12" cy="12" r="12" /> : <Rect width="24" height="24" rx="4" />}
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${clipId})`}>
            <Rect width="24" height="24" fill="#006C35" />
            <Path d="M7 9.5h10M8 11.5h8M9 13.5h6" stroke="#FFFFFF" strokeWidth="1.1" strokeLinecap="round" />
            <Path d="M7 16.5h10M8 15v3" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
          </G>
          {circle ? (
            <Circle cx="12" cy="12" r="11.5" stroke="rgba(0,0,0,0.12)" strokeWidth="1" fill="none" />
          ) : (
            <Rect width="24" height="24" rx="4" stroke="rgba(0,0,0,0.12)" strokeWidth="1" fill="none" />
          )}
        </Svg>
      );

    case 'SG':
      return (
        <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
          <Defs>
            <ClipPath id={clipId}>
              {circle ? <Circle cx="12" cy="12" r="12" /> : <Rect width="24" height="24" rx="4" />}
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${clipId})`}>
            <Rect width="24" height="12" fill="#ED2939" />
            <Rect y="12" width="24" height="12" fill="#FFFFFF" />
            <Path d="M6 4a3.8 3.8 0 100 5.6 3.2 3.2 0 110-5.6z" fill="#FFFFFF" />
            <Circle cx="8.5" cy="4.5" r="0.6" fill="#FFFFFF" />
            <Circle cx="9.8" cy="5.5" r="0.6" fill="#FFFFFF" />
            <Circle cx="9.4" cy="7.2" r="0.6" fill="#FFFFFF" />
            <Circle cx="7.6" cy="7.2" r="0.6" fill="#FFFFFF" />
            <Circle cx="7.2" cy="5.5" r="0.6" fill="#FFFFFF" />
          </G>
          {circle ? (
            <Circle cx="12" cy="12" r="11.5" stroke="rgba(0,0,0,0.12)" strokeWidth="1" fill="none" />
          ) : (
            <Rect width="24" height="24" rx="4" stroke="rgba(0,0,0,0.12)" strokeWidth="1" fill="none" />
          )}
        </Svg>
      );

    case 'GB':
      return (
        <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
          <Defs>
            <ClipPath id={clipId}>
              {circle ? <Circle cx="12" cy="12" r="12" /> : <Rect width="24" height="24" rx="4" />}
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${clipId})`}>
            <Rect width="24" height="24" fill="#012169" />
            <Path d="M0 0l24 24M24 0L0 24" stroke="#FFFFFF" strokeWidth="4.5" />
            <Path d="M0 0l24 24M24 0L0 24" stroke="#C8102E" strokeWidth="2.4" />
            <Path d="M12 0v24M0 12h24" stroke="#FFFFFF" strokeWidth="6.5" />
            <Path d="M12 0v24M0 12h24" stroke="#C8102E" strokeWidth="3.8" />
          </G>
          {circle ? (
            <Circle cx="12" cy="12" r="11.5" stroke="rgba(0,0,0,0.12)" strokeWidth="1" fill="none" />
          ) : (
            <Rect width="24" height="24" rx="4" stroke="rgba(0,0,0,0.12)" strokeWidth="1" fill="none" />
          )}
        </Svg>
      );

    case 'US':
      return (
        <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
          <Defs>
            <ClipPath id={clipId}>
              {circle ? <Circle cx="12" cy="12" r="12" /> : <Rect width="24" height="24" rx="4" />}
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${clipId})`}>
            <Rect width="24" height="24" fill="#FFFFFF" />
            <Rect y="0" width="24" height="1.85" fill="#B22234" />
            <Rect y="3.7" width="24" height="1.85" fill="#B22234" />
            <Rect y="7.4" width="24" height="1.85" fill="#B22234" />
            <Rect y="11.1" width="24" height="1.85" fill="#B22234" />
            <Rect y="14.8" width="24" height="1.85" fill="#B22234" />
            <Rect y="18.5" width="24" height="1.85" fill="#B22234" />
            <Rect y="22.2" width="24" height="1.85" fill="#B22234" />
            <Rect width="11" height="12.9" fill="#3C3B6E" />
            <Circle cx="2.8" cy="3.2" r="0.7" fill="#FFFFFF" />
            <Circle cx="5.5" cy="3.2" r="0.7" fill="#FFFFFF" />
            <Circle cx="8.2" cy="3.2" r="0.7" fill="#FFFFFF" />
            <Circle cx="4.1" cy="6.4" r="0.7" fill="#FFFFFF" />
            <Circle cx="6.8" cy="6.4" r="0.7" fill="#FFFFFF" />
            <Circle cx="2.8" cy="9.6" r="0.7" fill="#FFFFFF" />
            <Circle cx="5.5" cy="9.6" r="0.7" fill="#FFFFFF" />
            <Circle cx="8.2" cy="9.6" r="0.7" fill="#FFFFFF" />
          </G>
          {circle ? (
            <Circle cx="12" cy="12" r="11.5" stroke="rgba(0,0,0,0.12)" strokeWidth="1" fill="none" />
          ) : (
            <Rect width="24" height="24" rx="4" stroke="rgba(0,0,0,0.12)" strokeWidth="1" fill="none" />
          )}
        </Svg>
      );

    case 'AU':
      return (
        <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
          <Defs>
            <ClipPath id={clipId}>
              {circle ? <Circle cx="12" cy="12" r="12" /> : <Rect width="24" height="24" rx="4" />}
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${clipId})`}>
            <Rect width="24" height="24" fill="#012169" />
            <G>
              <Rect width="12" height="12" fill="#012169" />
              <Path d="M0 0l12 12M12 0L0 12" stroke="#FFFFFF" strokeWidth="2.7" />
              <Path d="M0 0l12 12M12 0L0 12" stroke="#C8102E" strokeWidth="1.3" />
              <Path d="M6 0v12M0 6h12" stroke="#FFFFFF" strokeWidth="3.6" />
              <Path d="M6 0v12M0 6h12" stroke="#C8102E" strokeWidth="2.1" />
            </G>
            <Circle cx="6" cy="18" r="1.8" fill="#FFFFFF" />
            <Circle cx="18" cy="4.8" r="0.7" fill="#FFFFFF" />
            <Circle cx="20" cy="9.3" r="0.7" fill="#FFFFFF" />
            <Circle cx="18" cy="18.3" r="0.7" fill="#FFFFFF" />
            <Circle cx="15.8" cy="10.8" r="0.7" fill="#FFFFFF" />
            <Circle cx="19.2" cy="12.9" r="0.5" fill="#FFFFFF" />
          </G>
          {circle ? (
            <Circle cx="12" cy="12" r="11.5" stroke="rgba(0,0,0,0.12)" strokeWidth="1" fill="none" />
          ) : (
            <Rect width="24" height="24" rx="4" stroke="rgba(0,0,0,0.12)" strokeWidth="1" fill="none" />
          )}
        </Svg>
      );

    default:
      return (
        <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
          {circle ? <Circle cx="12" cy="12" r="12" fill="#E2E8F0" /> : <Rect width="24" height="24" rx="4" fill="#E2E8F0" />}
        </Svg>
      );
  }
}
