/**
 * NOCTIS — Configuration & Design Parameters
 * Fictional Electric Car Brand Scrollytelling Experience
 */

window.NOCTIS_CONFIG = {
  // Brand details
  brand: {
    name: 'NOCTIS',
    tagline: 'Drive the night.',
    year: '2026'
  },

  // Animation easing token matching CSS cubic-bezier(0.16, 1, 0.3, 1)
  easing: [0.16, 1, 0.3, 1],

  // Scrollytelling frame sequences
  frames: {
    hero: {
      count: 600,
      desktopPath: 'assets/frames/hero/frame_{index}.webp',
      mobilePath: 'assets/frames/hero-mobile/frame_{index}.webp',
      preloadInitial: 40,
      lerpSpeed: 0.15
    },
    dismantle: {
      count: 200,
      desktopPath: 'assets/frames/dismantle/frame_{index}.webp',
      mobilePath: 'assets/frames/dismantle-mobile/frame_{index}.webp',
      preloadInitial: 20,
      lerpSpeed: 0.15
    }
  },

  // Pinned Section Heights
  sectionHeights: {
    hero: '600vh',
    statement: '100vh',
    dismantle: '350vh',
    lineup: '100vh',
    reserve: '100vh'
  },

  // Hero Scrollytelling Chapters & HUD ranges
  heroChapters: [
    {
      id: 'hero-ch1',
      start: 0.00,
      end: 0.12,
      hudChapter: '01/04'
    },
    {
      id: 'hero-ch2',
      start: 0.22,
      end: 0.40,
      hudChapter: '02/04'
    },
    {
      id: 'hero-ch3',
      start: 0.50,
      end: 0.68,
      hudChapter: '03/04'
    },
    {
      id: 'hero-ch4',
      start: 0.80,
      end: 1.00,
      hudChapter: '04/04'
    }
  ],

  // HUD Speed & Distance parameters
  heroHUD: {
    maxSpeedKmH: 118,
    maxDistanceKm: 4.2
  },

  // Dismantle Callouts (appear after 70% progress)
  // Coordinates are defined as percentages [x%, y%] of the stage canvas
  dismantleCallouts: [
    {
      id: 'body',
      label: 'BODY',
      title: 'Carbon composite monocoque',
      triggerProgress: 0.72,
      dot: { x: 38, y: 38 },
      text: { x: 22, y: 24 }
    },
    {
      id: 'battery',
      label: 'BATTERY',
      title: '110 kWh structural pack',
      triggerProgress: 0.78,
      dot: { x: 50, y: 58 },
      text: { x: 32, y: 76 }
    },
    {
      id: 'drive',
      label: 'DRIVE',
      title: 'Dual axial-flux motors, 680 kW',
      triggerProgress: 0.84,
      dot: { x: 68, y: 54 },
      text: { x: 74, y: 72 }
    },
    {
      id: 'light',
      label: 'LIGHT',
      title: 'Single-line LED signature',
      triggerProgress: 0.90,
      dot: { x: 74, y: 40 },
      text: { x: 78, y: 26 }
    }
  ],

  // Lineup Models Data
  cars: [
    {
      id: 'gt-e',
      num: '01',
      name: 'GT-E',
      tagline: 'The grand tourer.',
      description: 'Sculpted for pure aerodynamic silence across high-speed continental crossing.',
      specs: {
        range: '640 KM',
        accel: '3.1 S',
        power: '680 KW'
      },
      image: 'assets/cars/gt-e.webp',
      alt: 'NOCTIS GT-E Grand Tourer Coupe in Matte Graphite',
      swatches: ['#121418', '#252930', '#565B66', '#EDEAE4']
    },
    {
      id: 's',
      num: '02',
      name: 'S',
      tagline: 'Four doors, no compromise.',
      description: 'An executive sport saloon engineered with ruthless spatial precision and dynamic poise.',
      specs: {
        range: '600 KM',
        accel: '3.6 S',
        power: '520 KW'
      },
      image: 'assets/cars/s.webp',
      alt: 'NOCTIS S Four-Door Sport Sedan in Satin Bone White',
      swatches: ['#EDEAE4', '#C4C0B6', '#121418', '#2D323B']
    },
    {
      id: 'x',
      num: '03',
      name: 'X',
      tagline: 'Higher, never heavier.',
      description: 'Coupe silhouette elevated with active suspension for all-weather terrain authority.',
      specs: {
        range: '560 KM',
        accel: '4.2 S',
        power: '480 KW'
      },
      image: 'assets/cars/x.webp',
      alt: 'NOCTIS X Coupe SUV in Midnight Blue',
      swatches: ['#0B132B', '#1C2541', '#3A506B', '#EDEAE4']
    },
    {
      id: 'r',
      num: '04',
      name: 'R',
      tagline: 'Built for the track.',
      description: 'Stripped lightweight architecture with track aerodynamics and dual high-torque inverters.',
      specs: {
        range: '420 KM',
        accel: '2.4 S',
        power: '900 KW'
      },
      image: 'assets/cars/r.webp',
      alt: 'NOCTIS R Track Coupe with Fixed Wing in Satin Black',
      swatches: ['#08080A', '#1A0404', '#E1251B', '#EDEAE4']
    },
    {
      id: 'one',
      num: '05',
      name: 'ONE',
      tagline: 'The future, early.',
      description: 'Experimental hypercar archetype with solid-state cell integration and ultra-low drag.',
      specs: {
        range: '750 KM',
        accel: '1.9 S',
        power: 'CONCEPT'
      },
      image: 'assets/cars/one.webp',
      alt: 'NOCTIS ONE Concept Hypercar in Liquid Silver',
      swatches: ['#A0AAB5', '#CFE3FF', '#404552', '#07080A']
    }
  ]
};

