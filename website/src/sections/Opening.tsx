/**
 * The opening.
 *
 * Hero · composed after the reference: the headline and the story's three scenes on the left, a large
 * picture on the right with notches cut out of it, one for the "Get the app" toggle at the top right and
 * one the scene cards slide into. The picture plays the film from the app's sign-in screen (a basket
 * collected, cared for and handed back); the cards follow it and take it to their part when chosen, and
 * quick links to the services sit in its lower corner. On phones the cards sit in a notch at its foot.
 *
 * Story · type-led. One statement with three small pictures set into its lines like words; as you read
 * down the page its words fill in from grey to ink.
 */
import React, { useEffect, useRef, useState } from 'react';

import { BrandName, Lines } from '../components';
import { HERO, STORY } from '../content';
import artCollect from '../assets/art-collect.webp';
import artDry from '../assets/art-dry.webp';
import artIron from '../assets/art-iron.webp';
import { gsap, introDone, prefersReducedMotion, useScene } from '../motion';

/** The film from the app's sign-in screen, and where each scene card's part of it starts (s). */
const FILM = { mp4: '/media/hero-login.mp4?v=2', webm: '/media/hero-login.webm?v=2', poster: '/media/hero-login-poster.jpg?v=2' };
const AT = [0, 2.4, 12.4];
const sceneAt = (t: number) => (t >= AT[2] ? 2 : t >= AT[1] ? 1 : 0);

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const film = useRef<HTMLVideoElement>(null);
  const [cur, setCur] = useState(0);
  const [visible, setVisible] = useState(true);

  // the film plays while the hero is on screen; the cards follow it
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // Phones only autoplay a video that is muted as an attribute, which React does not write, so it is set here.
  // Where autoplay is still refused (iOS Low Power Mode, data saver), it starts on the visitor's first touch,
  // scroll or key instead of waiting on the browser's own play button.
  const playing = useRef(false);
  useEffect(() => {
    const v = film.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
  }, []);
  useEffect(() => {
    const v = film.current;
    if (!v || prefersReducedMotion()) return;
    if (!visible) {
      v.pause();
      return;
    }
    const start = () => {
      v.muted = true;
      return v.play().then(
        () => {
          playing.current = true;
        },
        () => {
          playing.current = false;
        },
      );
    };
    const events = ['touchstart', 'pointerdown', 'scroll', 'keydown'] as const;
    const retry = () => {
      start().then(() => {
        if (playing.current) events.forEach((e) => window.removeEventListener(e, retry));
      });
    };
    start().then(() => {
      if (!playing.current) events.forEach((e) => window.addEventListener(e, retry, { passive: true }));
    });
    return () => events.forEach((e) => window.removeEventListener(e, retry));
  }, [visible]);

  useScene(ref, ({ q, one }) => {
    // it enters as the opening intro lifts
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.05, paused: true });
    introDone.then(() => tl.play());
    tl.from(one('.hero__panel'), { clipPath: 'inset(0% 0% 100% 0% round 28px)', duration: 1.5, ease: 'expo.inOut' }, 0)
      .from(q('.hero__title .line__in'), { yPercent: 110, duration: 1.2, stagger: 0.08 }, 0.35)
      .from(q('.hero__card'), { y: 50, opacity: 0, duration: 1.1, stagger: 0.07 }, 0.75)
      .from(q('.hero__text'), { y: 16, opacity: 0, duration: 1, stagger: 0.04 }, 0.95);
  }, { eager: true });

  // a card takes the film to its part
  const pick = (i: number) => {
    const v = film.current;
    setCur(i);
    if (!v) return;
    v.currentTime = AT[i] + 0.05;
    if (!prefersReducedMotion()) v.play().catch(() => {});
  };
  const slide = HERO.slides[cur];

  return (
    <section className="hero" ref={ref} id="top" aria-labelledby="hero-title" style={{ '--slide': slide.color } as React.CSSProperties}>
      <div className="hero__panel">
        <video
          ref={film}
          className="hero__film"
          poster={FILM.poster}
          muted
          loop
          playsInline
          autoPlay={!prefersReducedMotion()}
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          controls={false}
          aria-label="Washing Basket at work: a basket collected, washed, dried, ironed, folded and handed back"
          onTimeUpdate={(e) => {
            const s = sceneAt(e.currentTarget.currentTime);
            setCur((c) => (c === s ? c : s));
          }}
        >
          {/* MP4 first: every phone plays it, and plays it in hardware */}
          <source src={FILM.mp4} type="video/mp4" />
          <source src={FILM.webm} type="video/webm" />
        </video>
      </div>

      {/* the two notches, cut out of the picture (drawn outside its clip, so their edges stay clean) */}
      <span className="notch notch--top" aria-hidden="true" />

      <h1 className="hero__title" id="hero-title">
        <Lines lines={HERO.title} />
      </h1>

      <div className="hero__cards" role="tablist" aria-label="The three parts of every order">
        <span className="hero__notch" aria-hidden="true" />
        {HERO.slides.map((s, i) => (
          <button
            key={s.word}
            type="button"
            role="tab"
            aria-selected={i === cur}
            className={`hero__card${i === cur ? ' is-on' : ''}`}
            onClick={() => pick(i)}
          >
            <span className="hero__at">
              <b>{String(i + 1).padStart(2, '0')}</b> / {String(HERO.slides.length).padStart(2, '0')}
            </span>
            <span className="hero__word">{s.word}</span>
          </button>
        ))}
      </div>

      <p className="hero__text">{HERO.body}</p>
    </section>
  );
}

/** Small pictures that sit inside the story's lines, like words. */
const INLINE: Record<number, { src: string; pos: string }> = {
  6: { src: artCollect, pos: '50% 60%' },
  12: { src: artIron, pos: '50% 72%' },
  19: { src: artDry, pos: '50% 34%' },
};

const SCENE_ALT = 'The Washing Basket team at work: loading the machines, folding, ironing and hanging fresh laundry';

export function Story() {
  const ref = useRef<HTMLElement>(null);

  useScene(ref, ({ q, one, desktop }) => {
    // the workshop along the foot of the section: it rises a touch on wide screens, and on phones, where it
    // is shown taller than the screen is wide, it pans across so the whole room passes by
    const scene = one<HTMLElement>('.story__scene');
    const art = one<HTMLElement>('.story__art');
    if (scene && art) {
      if (desktop) {
        gsap.fromTo(art, { yPercent: 10 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: scene, start: 'top bottom', end: 'bottom bottom', scrub: 0.6 } });
      } else {
        gsap.fromTo(
          art,
          { x: 0 },
          {
            x: () => -Math.max(0, art.offsetWidth - scene.clientWidth),
            ease: 'none',
            scrollTrigger: { trigger: scene, start: 'top bottom', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true },
          },
        );
      }
    }

    const words = q('.story__text .w');
    if (!words.length) return;
    gsap.set(words, { opacity: 0.16 });
    gsap.to(words, {
      opacity: 1,
      stagger: 0.1,
      ease: 'none',
      scrollTrigger: { trigger: '.story__text', start: 'top 80%', end: 'bottom 50%', scrub: 0.6 },
    });
    const pics = q('.story__pic');
    if (pics.length) {
      gsap.from(pics, {
        width: 0,
        duration: 1.2,
        stagger: 0.12,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.story__text', start: 'top 75%' },
      });
    }
  });

  const storyText =
    STORY?.text ||
    'Campus life is full. Lectures, labs, deadlines, plans, practice, and somewhere in between, the laundry that should never have been yours to worry about.';

  return (
    <section className="story" ref={ref} id="story" aria-labelledby="story-label">
      <p className="index" id="story-label">
        <span>01</span>
        {STORY?.label || 'Why Washing Basket exists'}
      </p>
      <p className="story__text">
        {storyText.split(' ').map((w: string, i: number) => (
          <React.Fragment key={i}>
            {INLINE[i] ? (
              <span className="story__pic" aria-hidden="true">
                <img src={INLINE[i].src} alt="" style={{ objectPosition: INLINE[i].pos }} loading="lazy" />
              </span>
            ) : null}
            <span className="w">{w} </span>
          </React.Fragment>
        ))}
      </p>
      <div className="story__aside" data-reveal>
        <p>{STORY?.aside}</p>
        <p className="story__sign"><BrandName /> · LPU, NIT Jalandhar &amp; Model Town</p>
      </div>
      <figure className="story__scene">
        {/* the workshop at work: a 4 s silent loop (workshop-loop/loop.py), or its still frame without motion */}
        {prefersReducedMotion() ? (
          <img className="story__art" src="/media/workshop-loop-poster.jpg?v=2" width={1920} height={516} alt={SCENE_ALT} loading="lazy" decoding="async" />
        ) : (
          <video
            className="story__art"
            width={1920}
            height={516}
            poster="/media/workshop-loop-poster.jpg?v=2"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={SCENE_ALT}
          >
            <source src="/media/workshop-loop.webm?v=2" type="video/webm" />
            <source src="/media/workshop-loop.mp4?v=2" type="video/mp4" />
          </video>
        )}
      </figure>
    </section>
  );
}
