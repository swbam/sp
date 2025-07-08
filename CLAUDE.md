# **🎯 MySetlist Development Brief \- Transform Spotify Clone to Concert Setlist Voting Platform**

## **Starting Point**

You are working with the **mrwebwork/spotify** template (Next.js 13.4+, Supabase, TypeScript, Tailwind). This is a fully functional Spotify clone that we will transform into MySetlist \- a concert setlist voting platform. 

---

## **🚨 CRITICAL RULES \- READ FIRST**

### **Rule \#1: DELETE ALL MUSIC PLAYBACK**

* **NO audio streaming functionality**  
* **NO song file uploads**  
* **NO music player components**  
* **NO volume controls or audio hooks**  
* Songs in our app are just TEXT (title \+ artist name)

### **Rule \#2: SEARCH \= ARTISTS ONLY**

* Search functionality finds ARTISTS, not songs/venues/shows  
* Keep the existing search page structure but modify for artists

### **Rule \#3: PRESERVE TEMPLATE PATTERNS**

* **Keep**: Supabase client setup, auth flow, modal system, toast notifications  
* **Keep**: File structure patterns, component naming conventions  
* **Keep**: Server/client component separation patterns  
* **Modify**: Repurpose existing components rather than creating from scratch

### **Rule \#4: DATABASE APPROACH**

* **DELETE** existing music tables first, then create new schema  
* Use Supabase migrations for all changes  
* Follow the template's existing database patterns

### **Rule \#5: NO EXTRA FEATURES**

* **NO** user bios, location data, or attendance tracking  
* **NO** Stripe/payments  
* **NO** song preview/streaming  
* **ONLY** core setlist voting functionality

### **Rule \#6: USE 6 SUB-AGENTS AT THE SAME TIME TO GET THIS IMPLEMENTED. ALWAYS ULTRATHINK AND READ UP TO 2000 LINES OF CODE FOR EACH FILE. REVIEW [PRD.MD](http://PRD.MD) HEAVILY AND ULTRATHINK BEFORE IMPLEMENTING.**

---

## **📁 TEMPLATE STRUCTURE YOU'RE WORKING WITH**

spotify-clone/  
├── app/                      \# Next.js 13 App Router  
│   ├── (site)/              \# Public routes group  
│   ├── account/             \# User account (modify for profile)  
│   ├── api/                 \# API routes  
│   ├── liked/               \# DELETE THIS ENTIRELY  
│   ├── search/              \# MODIFY for artist search only  
│   ├── layout.tsx           \# Has providers \- KEEP structure  
│   └── globals.css          \# Tailwind styles  
├── components/                
│   ├── AuthModal.tsx        \# KEEP \- for authentication  
│   ├── Header.tsx           \# MODIFY \- remove player controls  
│   ├── Library.tsx          \# TRANSFORM to "Following Artists"  
│   ├── ListItem.tsx         \# REPURPOSE for show cards  
│   ├── MediaItem.tsx        \# DELETE  
│   ├── Modal.tsx            \# KEEP \- base modal  
│   ├── Player.tsx           \# DELETE ENTIRELY  
│   ├── PlayerContent.tsx    \# DELETE ENTIRELY  
│   ├── PlayButton.tsx       \# DELETE ENTIRELY  
│   ├── Sidebar.tsx          \# MODIFY navigation items  
│   ├── SidebarItem.tsx      \# KEEP  
│   ├── Slider.tsx           \# DELETE (volume control)  
│   ├── SongItem.tsx         \# DELETE ENTIRELY  
│   └── UploadModal.tsx      \# DELETE ENTIRELY  
├── actions/                 \# Server actions  
│   ├── getSongs\*.ts         \# DELETE all song-related  
│   └── (create new ones)    \# for artists, shows, votes  
├── hooks/  
│   ├── useAuthModal.tsx     \# KEEP  
│   ├── useDebounce.tsx      \# KEEP    
│   ├── useLoadImage.tsx     \# REPURPOSE for artist images  
│   ├── useOnPlay.tsx        \# DELETE  
│   ├── usePlayer.tsx        \# DELETE  
│   ├── useSubscribeModal.tsx \# DELETE  
│   └── useUser.tsx          \# KEEP  
├── libs/  
│   ├── helpers.ts           \# KEEP utility functions  
│   ├── stripe.ts            \# DELETE  
│   ├── stripeClient.ts      \# DELETE  
│   └── supabaseClient.ts    \# KEEP  
├── providers/  
│   ├── ModalProvider.tsx    \# KEEP but remove music modals  
│   ├── SupabaseProvider.tsx \# KEEP  
│   ├── ToasterProvider.tsx  \# KEEP  
│   └── UserProvider.tsx     \# KEEP  
└── types.ts                 \# MODIFY with new types

---

## **🗃️ DATABASE TRANSFORMATION**

### **Step 1: Delete Music Tables**

\-- Run these in Supabase SQL editor  
DROP TABLE IF EXISTS songs CASCADE;  
DROP TABLE IF EXISTS liked\_songs CASCADE;  
DROP TABLE IF EXISTS customers CASCADE;  
DROP TABLE IF EXISTS prices CASCADE;  
DROP TABLE IF EXISTS products CASCADE;  
DROP TABLE IF EXISTS subscriptions CASCADE;

### **Step 2: Create New Schema**

\-- Artists table  
CREATE TABLE artists (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  spotify\_id VARCHAR(255) UNIQUE,  
  name VARCHAR(255) NOT NULL,  
  slug VARCHAR(255) UNIQUE NOT NULL,  
  image\_url TEXT,  
  genres JSONB DEFAULT '\[\]',  
  followers INTEGER DEFAULT 0,  
  verified BOOLEAN DEFAULT FALSE,  
  created\_at TIMESTAMPTZ DEFAULT NOW(),  
  updated\_at TIMESTAMPTZ DEFAULT NOW()  
);

\-- Venues table  
CREATE TABLE venues (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  name VARCHAR(255) NOT NULL,  
  slug VARCHAR(255) UNIQUE NOT NULL,  
  city VARCHAR(255) NOT NULL,  
  state VARCHAR(255),  
  country VARCHAR(255) NOT NULL,  
  capacity INTEGER,  
  created\_at TIMESTAMPTZ DEFAULT NOW()  
);

\-- Shows table    
CREATE TABLE shows (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  artist\_id UUID REFERENCES artists(id) ON DELETE CASCADE,  
  venue\_id UUID REFERENCES venues(id),  
  name VARCHAR(255) NOT NULL,  
  date DATE NOT NULL,  
  start\_time TIME,  
  status VARCHAR(20) DEFAULT 'upcoming',  
  ticket\_url TEXT,  
  created\_at TIMESTAMPTZ DEFAULT NOW(),  
  updated\_at TIMESTAMPTZ DEFAULT NOW()  
);

\-- Songs table (just metadata, NO audio)  
CREATE TABLE songs (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  title VARCHAR(255) NOT NULL,  
  artist\_name VARCHAR(255) NOT NULL,  
  spotify\_id VARCHAR(255),  
  created\_at TIMESTAMPTZ DEFAULT NOW()  
);

\-- Setlists table  
CREATE TABLE setlists (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  show\_id UUID REFERENCES shows(id) ON DELETE CASCADE,  
  type VARCHAR(20) NOT NULL CHECK (type IN ('predicted', 'actual')),  
  is\_locked BOOLEAN DEFAULT FALSE,  
  created\_by UUID REFERENCES auth.users(id),  
  created\_at TIMESTAMPTZ DEFAULT NOW()  
);

\-- Setlist songs with voting  
CREATE TABLE setlist\_songs (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  setlist\_id UUID REFERENCES setlists(id) ON DELETE CASCADE,  
  song\_id UUID REFERENCES songs(id),  
  position INTEGER NOT NULL,  
  upvotes INTEGER DEFAULT 0,  
  downvotes INTEGER DEFAULT 0,  
  created\_at TIMESTAMPTZ DEFAULT NOW(),  
  UNIQUE(setlist\_id, position)  
);

\-- Votes table  
CREATE TABLE votes (  
  id UUID DEFAULT gen\_random\_uuid() PRIMARY KEY,  
  user\_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  
  setlist\_song\_id UUID REFERENCES setlist\_songs(id) ON DELETE CASCADE,  
  vote\_type VARCHAR(10) CHECK (vote\_type IN ('up', 'down')),  
  created\_at TIMESTAMPTZ DEFAULT NOW(),  
  UNIQUE(user\_id, setlist\_song\_id)  
);

\-- User following artists  
CREATE TABLE user\_artists (  
  user\_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  
  artist\_id UUID REFERENCES artists(id) ON DELETE CASCADE,  
  created\_at TIMESTAMPTZ DEFAULT NOW(),  
  PRIMARY KEY(user\_id, artist\_id)  
);

\-- Create indexes  
CREATE INDEX idx\_shows\_date ON shows(date);  
CREATE INDEX idx\_shows\_artist ON shows(artist\_id);  
CREATE INDEX idx\_artists\_slug ON artists(slug);

### **Step 3: RLS Policies**

\-- Enable RLS  
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;  
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;  
ALTER TABLE setlists ENABLE ROW LEVEL SECURITY;  
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

\-- Public read policies  
CREATE POLICY "Anyone can view artists" ON artists FOR SELECT USING (true);  
CREATE POLICY "Anyone can view shows" ON shows FOR SELECT USING (true);  
CREATE POLICY "Anyone can view setlists" ON setlists FOR SELECT USING (true);

\-- Vote policies  
CREATE POLICY "Users can create votes" ON votes   
  FOR INSERT WITH CHECK (auth.uid() \= user\_id);  
CREATE POLICY "Users can update own votes" ON votes   
  FOR UPDATE USING (auth.uid() \= user\_id);

---

## **🔨 IMPLEMENTATION STEPS**

### **Phase 1: Cleanup (Day 1\)**

**Delete Player Components**

 rm components/Player.tsx  
rm components/PlayerContent.tsx  
rm components/PlayButton.tsx  
rm components/Slider.tsx  
rm components/SongItem.tsx  
rm components/MediaItem.tsx  
rm components/UploadModal.tsx  
rm hooks/usePlayer.tsx  
rm hooks/useOnPlay.tsx

1. 

**Remove from layout.tsx**

 // DELETE this line from app/layout.tsx  
import Player from '@/components/Player';  
// DELETE \<Player /\> component from JSX

2. 

**Update types.ts**

 // DELETE all Song, Subscription, Price, Product types  
// ADD:  
export interface Artist {  
  id: string;  
  spotify\_id?: string;  
  name: string;  
  slug: string;  
  image\_url?: string;  
  genres: string\[\];  
  followers: number;  
  verified: boolean;  
}

export interface Show {  
  id: string;  
  artist\_id: string;  
  venue\_id: string;  
  name: string;  
  date: string;  
  start\_time?: string;  
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';  
  artist?: Artist;  
  venue?: Venue;  
}

export interface SetlistSong {  
  id: string;  
  setlist\_id: string;  
  song\_id: string;  
  position: number;  
  upvotes: number;  
  downvotes: number;  
  song?: Song;  
}

3. 

### **Phase 2: Core Components (Day 2-3)**

**Transform Header.tsx**

 // REMOVE all player controls  
// KEEP search functionality but update placeholder  
// REMOVE upload button  
// ADD link to logo:  
\<Link href="/"\>  
  \<h1 className="text-xl font-bold"\>MySetlist\</h1\>  
\</Link\>

1. 

**Create VoteButton.tsx**

 'use client';

import { FaThumbsUp, FaThumbsDown } from 'react-icons/fa';  
import { twMerge } from 'tailwind-merge';

interface VoteButtonProps {  
  upvotes: number;  
  downvotes: number;  
  onVote: (type: 'up' | 'down') \=\> void;  
  disabled?: boolean;  
  userVote?: 'up' | 'down' | null;  
}

const VoteButton: React.FC\<VoteButtonProps\> \= ({  
  upvotes,  
  downvotes,  
  onVote,  
  disabled,  
  userVote  
}) \=\> {  
  const score \= upvotes \- downvotes;

  return (  
    \<div className="flex items-center gap-2"\>  
      \<button  
        onClick={() \=\> onVote('up')}  
        disabled={disabled}  
        className={twMerge(  
          "text-neutral-400 hover:text-white transition",  
          userVote \=== 'up' && "text-green-500",  
          disabled && "opacity-50 cursor-not-allowed"  
        )}  
      \>  
        \<FaThumbsUp size={20} /\>  
      \</button\>  
        
      \<span className={twMerge(  
        "min-w-\[40px\] text-center font-semibold",  
        score \> 0 && "text-green-500",  
        score \< 0 && "text-red-500",  
        score \=== 0 && "text-neutral-400"  
      )}\>  
        {score \> 0 ? \`+${score}\` : score}  
      \</span\>  
        
      \<button  
        onClick={() \=\> onVote('down')}  
        disabled={disabled}  
        className={twMerge(  
          "text-neutral-400 hover:text-white transition",  
          userVote \=== 'down' && "text-red-500",  
          disabled && "opacity-50 cursor-not-allowed"  
        )}  
      \>  
        \<FaThumbsDown size={20} /\>  
      \</button\>  
    \</div\>  
  );  
};

export default VoteButton;

2. 

**Update Sidebar.tsx**

 // Update navigation items:  
const routes \= useMemo(() \=\> \[  
  {  
    icon: HiHome,  
    label: 'Home',  
    active: pathname \=== '/',  
    href: '/',  
  },  
  {  
    icon: BiSearch,  
    label: 'Search Artists',  
    active: pathname \=== '/search',  
    href: '/search',  
  },  
  {  
    icon: RiCalendarLine, // Add this import  
    label: 'Shows',  
    active: pathname?.startsWith('/shows'),  
    href: '/shows',  
  },  
\], \[pathname\]);

3. 

### **Phase 3: New Pages (Day 4-5)**

**Artist Page Structure**

 app/artists/\[slug\]/  
├── page.tsx              \# Artist detail page  
├── loading.tsx           \# Loading skeleton  
└── components/  
    ├── ArtistHeader.tsx  \# Artist info \+ follow button  
    └── ShowsList.tsx     \# Upcoming shows for artist

1. 

**Shows Page Structure**

 app/shows/  
├── page.tsx              \# All upcoming shows  
├── \[id\]/  
│   ├── page.tsx          \# Show detail with setlist  
│   └── components/  
│       ├── ShowInfo.tsx  \# Date, venue, ticket link  
│       └── SetlistVoting.tsx \# Main voting interface  
└── loading.tsx

2. 

### **Phase 4: API Routes (Day 6\)**

**Vote Submission** \- `app/api/votes/route.ts`  
 import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';import { cookies } from 'next/headers';import { NextResponse } from 'next/server';export async function POST(request: Request) {  const supabase \= createRouteHandlerClient({ cookies });    // Get user  const { data: { user } } \= await supabase.auth.getUser();  if (\!user) {    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });  }  const { setlistSongId, voteType } \= await request.json();  // Check existing vote  const { data: existingVote } \= await supabase    .from('votes')    .select()    .eq('user\_id', user.id)    .eq('setlist\_song\_id', setlistSongId)    .single();  if (existingVote) {    if (existingVote.vote\_type \=== voteType) {      // Remove vote if clicking same button      await supabase        .from('votes')        .delete()        .eq('id', existingVote.id);    } else {      // Update vote type      await supabase        .from('votes')        .update({ vote\_type: voteType })        .eq('id', existingVote.id);    }  } else {    // Create new vote    await supabase      .from('votes')      .insert({        user\_id: user.id,        setlist\_song\_id: setlistSongId,        vote\_type: voteType      });  }  // Update vote counts (use Supabase function)  await supabase.rpc('update\_vote\_counts', {    song\_id: setlistSongId  });  return NextResponse.json({ success: true });}

1. 

---

## **🎨 STYLING GUIDELINES**

### **Use Template's Existing Patterns**

* **Colors**: Keep dark theme with `bg-neutral-900`, `bg-neutral-800`  
* **Hover States**: Use `hover:bg-neutral-800/50` pattern  
* **Gradients**: Use template's gradient classes  
* **Spacing**: Follow template's padding conventions

### **New Color Accents**

/\* Add to globals.css \*/  
.text-upvote {  
  @apply text-green-500;  
}

.text-downvote {  
  @apply text-red-500;  
}

.bg-show-card {  
  @apply bg-gradient-to-b from-neutral-800/50 to-neutral-900;  
}

---

## **⚡ PERFORMANCE REQUIREMENTS**

1. **Use Template's Image Pattern**

   * Keep using `useLoadImage` hook for artist images  
   * Follow same loading states as template  
2. **Server Components**

   * Keep pages as server components (like template)  
   * Only use 'use client' for interactive components  
3. **Data Fetching**

   * Follow template's action pattern for data fetching  
   * Create actions in `/actions` folder

---

## **🚫 DO NOT ADD**

1. **No Additional Features**

   * No user profiles beyond basic auth  
   * No social features  
   * No comments/reviews  
   * No direct messaging  
2. **No External Services** (in MVP)

   * No email notifications  
   * No push notifications  
   * No analytics  
3. **No Complex UI**

   * No maps for venues  
   * No data visualizations  
   * No advanced filters

---

## **✅ DEFINITION OF DONE**

The project is complete when:

1. **All music features removed** \- No trace of audio playback  
2. **Core pages working**:  
   * Home shows upcoming concerts  
   * Search finds artists only  
   * Artist pages show their upcoming shows  
   * Show pages display voting interface  
3. **Voting functional** \- Users can upvote/downvote predicted songs  
4. **Auth working** \- Sign up, login, logout via Supabase  
5. **Mobile responsive** \- Works on all screen sizes  
6. **No TypeScript errors** \- Clean build  
7. **Database migrated** \- New schema active

---

## **🎯 FINAL CHECKLIST**

Before considering any task complete:

* \[ \] Removed all audio/streaming code?  
* \[ \] Following template's component patterns?  
* \[ \] Using template's styling conventions?  
* \[ \] Server/client components used correctly?  
* \[ \] Database queries use template's patterns?  
* \[ \] No extra features added?  
* \[ \] Mobile responsive?  
* \[ \] TypeScript types updated?

---

**Remember**: You're TRANSFORMING an existing Spotify clone, not building from scratch. Reuse and repurpose wherever possible. The template's patterns are your guide.



