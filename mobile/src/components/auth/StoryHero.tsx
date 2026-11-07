import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { memo, useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

const STORY = require('../../../assets/video/washing-basket-hero.mp4');
/** The film is 1200x1612: the artwork plus 300 px of each scene's flat background above it. */
const FILM_ASPECT = 1612 / 1200;
/** Share of the film's height above the artwork that is plain background in every scene. */
const TOP_BAND = 0.256;
const POSTER = require('../../../assets/video/washing-basket-hero-poster.jpg');

type Props = {
  width: number;
  height: number;
  /** Plays only while true (intro finished, screen focused). */
  playing: boolean;
  /** Reduced motion: show the poster frame and never start the video. */
  still?: boolean;
  radius?: number;
  /** Height of the top scrim that keeps the status bar legible over the film. */
  scrim?: number;
  /** Move video upward (in pixels) so character and action stay comfortably in view above the bottom sheet. */
  shiftY?: number;
};

/**
 * The silent, looping brand story at the top of the login screen.
 * A poster frame sits underneath, so there is always a picture: before the
 * video is ready, if it fails to load, or when motion is reduced.
 */
export const StoryHero = memo(function StoryHero({ width, height, playing, still, radius = 0, scrim = 0, shiftY = 48 }: Props) {
  const player = useVideoPlayer(still ? null : STORY, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers'; // never interrupt the user's music
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  useEffect(() => {
    if (still) return;
    try {
      if (playing) {
        const res = player.play() as any;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      } else {
        player.pause();
      }
    } catch {
      // safe fallback if background media play is aborted by browser
    }
  }, [playing, still, player]);

  // Cross-fade from the poster once frames are actually moving.
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = withTiming(isPlaying && status === 'readyToPlay' ? 1 : shown.value, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [isPlaying, status, shown]);
  const videoStyle = useAnimatedStyle(() => ({ opacity: shown.value }));
  // The film always covers the frame. When the frame is taller than the film, the film grows
  // and its sides are trimmed evenly (each scene keeps flat background at its edges). When the
  // frame is shorter, the flat background band at the top (~9% of the film) is trimmed first,
  // then the bottom, so faces stay in view.
  const baseH = Math.max(Math.round(width * FILM_ASPECT), Math.ceil(height));
  const filmH = baseH + shiftY;
  const filmW = Math.round(filmH / FILM_ASPECT);
  const excess = Math.max(0, filmH - height);
  const top = -Math.min(excess, Math.round(filmH * TOP_BAND) + shiftY);
  const film = { position: 'absolute' as const, left: Math.round((width - filmW) / 2), top, width: filmW, height: filmH };

  return (
    <View
      style={[styles.frame, { width, height, borderRadius: radius }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Washing Basket collects, washes, dries, irons, folds and delivers your laundry to your door."
    >
      <Image source={POSTER} style={film} resizeMode="cover" />
      {!still && status !== 'error' && (
        <Animated.View style={[film, videoStyle]} pointerEvents="none">
          <VideoView
            player={player}
            // explicit size: a web <video> keeps its intrinsic size under inset:0
            style={{ width: filmW, height: filmH }}
            contentFit="cover"
            nativeControls={false}
            allowsPictureInPicture={false}
            fullscreenOptions={{ enable: false }}
          />
        </Animated.View>
      )}
      {scrim > 0 && (
        <Svg style={[StyleSheet.absoluteFill, { height: scrim }]} width="100%" height={scrim} pointerEvents="none">
          <Defs>
            <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity={0.28} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height={scrim} fill="url(#scrim)" />
        </Svg>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: '#013A81' },
});
