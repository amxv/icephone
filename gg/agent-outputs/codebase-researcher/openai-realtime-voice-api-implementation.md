# OpenAI Real-time Voice API Implementation Guide

This document provides a comprehensive analysis of the OpenAI Real-time Voice API implementation in the Kidsway e-commerce project. The implementation uses OpenAI's WebRTC-based Real-time API to create a voice shopping assistant that can search products, manage cart operations, and even generate virtual try-on images.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Backend: Session API Route](#backend-session-api-route)
3. [Frontend: Voice Session Hook](#frontend-voice-session-hook)
4. [Tool Definitions for Real-time API](#tool-definitions-for-real-time-api)
5. [UI Components](#ui-components)
6. [State Management](#state-management)
7. [System Prompt for Voice](#system-prompt-for-voice)
8. [Rate Limiting](#rate-limiting)
9. [How Everything Connects](#how-everything-connects)

---

## Architecture Overview

The voice agent implementation consists of several interconnected pieces:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                             │
│  ┌──────────────────┐    ┌─────────────────┐    ┌────────────────┐ │
│  │ VoiceModePanel   │◄───│ useVoiceSession │◄───│ chat-ui-store  │ │
│  │ (UI Component)   │    │ (Hook)          │    │ (Zustand)      │ │
│  └────────┬─────────┘    └────────┬────────┘    └────────────────┘ │
│           │                       │                                  │
│           │              ┌────────▼────────┐                        │
│           │              │ RTCPeerConnection│                        │
│           │              │ + DataChannel    │                        │
│           │              └────────┬────────┘                        │
└───────────┼───────────────────────┼─────────────────────────────────┘
            │                       │
            │                       │ WebRTC (Audio + Events)
            │                       ▼
            │              ┌─────────────────────┐
            │              │ OpenAI Realtime API │
            │              │ (gpt-realtime-mini) │
            │              └─────────────────────┘
            │
            │ HTTP (Ephemeral Token)
            ▼
┌───────────────────────────────────────────────────────────────────┐
│                        Backend (Next.js)                           │
│  ┌─────────────────────┐    ┌──────────────────┐                  │
│  │ /api/ai/session     │───►│ OpenAI Sessions  │                  │
│  │ (API Route)         │    │ API              │                  │
│  └─────────────────────┘    └──────────────────┘                  │
│                                                                    │
│  Dependencies:                                                     │
│  - buildVoiceSystemPrompt() from src/lib/ai/system-prompt.ts      │
│  - openAIRealtimeTools from src/lib/ai/tools.ts                   │
│  - Rate limit checks from src/actions/ai/rate-limits.ts           │
└───────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| Session API | `src/app/api/ai/session/route.ts` | Creates ephemeral tokens for WebRTC connection |
| Voice Hook | `src/hooks/useVoiceSession.ts` | Manages WebRTC connection and tool execution |
| Voice Panel | `src/components/storefront/ai/VoiceModePanel.tsx` | Main UI component |
| Tools | `src/lib/ai/tools.ts` | Tool definitions in OpenAI format |
| System Prompt | `src/lib/ai/system-prompt.ts` | Voice-optimized prompt builder |
| Rate Limits | `src/actions/ai/rate-limits.ts` | Voice seconds tracking |

---

## Backend: Session API Route

**File: `/Users/ashray/code/amxv/kidsway-ai-demo/src/app/api/ai/session/route.ts`**

This API route creates an ephemeral session token that the frontend uses to establish a WebRTC connection with OpenAI's Real-time API.

### Complete Implementation

```typescript
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { getMemoriesForSystemPrompt } from '@/actions/ai/memory';
import { getKidPhotosForSystemPrompt } from '@/actions/ai/kid-photos';
import { checkVoiceRateLimit } from '@/actions/ai/rate-limits';
import { getProductContextForAI } from '@/actions/storefront/products';
import { buildVoiceSystemPrompt, type ProductContext } from '@/lib/ai/system-prompt';
import { openAIRealtimeTools } from '@/lib/ai/tools';

// OpenAI Realtime API endpoint
const OPENAI_REALTIME_API = 'https://api.openai.com/v1/realtime/sessions';

// Helper to extract product ID from URL path
function extractProductIdFromUrl(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    // Match patterns: /products/{id} or /{locale}/products/{id}
    const match = url.pathname.match(/^(?:\/[a-z]{2})?\/products\/([^/]+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Voice options supported by OpenAI Realtime
type VoiceOption = 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'marin' | 'sage' | 'shimmer' | 'verse';

export async function POST(request: Request) {
  try {
    // Check if disabled due to non-payment
    if (process.env.NEXT_PUBLIC_NON_PAYMENT_DISABLED === 'true') {
      return new Response(
        JSON.stringify({
          error: 'Service disabled',
          message: 'Cannot use AI assistant due to non payment',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check voice rate limit
    const rateLimitCheck = await checkVoiceRateLimit();
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `You've used all your voice chat time for today. Your limit resets at midnight UTC.`,
          remainingSeconds: rateLimitCheck.remainingSeconds,
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const body = await request.json();
    const { voice, pageContext } = body as {
      voice?: VoiceOption;
      pageContext?: string;
    };

    // Detect locale preference
    let locale: string = 'en';
    try {
      if (pageContext) {
        const url = new URL(pageContext);
        if (/^\/ar(\/|$)/.test(url.pathname)) {
          locale = 'ar';
        }
      }
    } catch {
      // ignore parsing issues
    }
    if (locale !== 'ar') {
      const accept = request.headers.get('accept-language');
      if (accept?.startsWith('ar')) {
        locale = 'ar';
      }
    }

    // Load user memories, kid photos, and product context in parallel
    const productId = pageContext ? extractProductIdFromUrl(pageContext) : null;

    const [memories, kidPhotos, productContextData] = await Promise.all([
      getMemoriesForSystemPrompt(),
      getKidPhotosForSystemPrompt(),
      productId ? getProductContextForAI(productId) : Promise.resolve(null),
    ]);

    // Build product context object if on a product page
    let productContext: ProductContext | undefined;
    if (productContextData) {
      productContext = {
        productId: productId!,
        titleEn: productContextData.titleEn,
        titleAr: productContextData.titleAr,
        brandName: productContextData.brandName,
        categoryNameEn: productContextData.categoryNameEn,
        categoryNameAr: productContextData.categoryNameAr,
        salePrice: productContextData.salePrice,
        availableSizes: productContextData.availableSizes,
        availableColors: productContextData.availableColors,
        isInStock: productContextData.isInStock,
        gender: productContextData.gender,
      };
    }

    // Build system prompt (voice-optimized version)
    const kidPhotosForPrompt = kidPhotos !== 'No kid photos uploaded yet.' ? kidPhotos : undefined;
    const systemPrompt = buildVoiceSystemPrompt(memories, pageContext, locale, productContext, kidPhotosForPrompt);

    // Create ephemeral session with OpenAI Realtime API
    const openaiResponse = await fetch(OPENAI_REALTIME_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-realtime-mini-2025-12-15',
        voice: 'marin',
        modalities: ['audio', 'text'],
        instructions: systemPrompt,
        tools: openAIRealtimeTools,
        tool_choice: 'auto',
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI Realtime API error:', errorText);
      return new Response(
        JSON.stringify({
          error: 'Failed to create voice session',
          message: 'Could not connect to voice service',
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Return OpenAI response (contains client_secret.value for WebRTC)
    const sessionData = await openaiResponse.json();

    // Include debug info for DevDebugPanel (only in development)
    const responseData = {
      ...sessionData,
      _debug: process.env.NODE_ENV === 'development' ? {
        systemPrompt,
        kidPhotos: kidPhotosForPrompt || null,
        pageContext: pageContext || null,
        availableTools: openAIRealtimeTools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      } : undefined,
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Voice session API error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
```

### Key Points

1. **Authentication Required**: Uses `better-auth` to verify user session
2. **Rate Limiting**: Checks voice seconds before creating session
3. **Context Gathering**: Loads user memories, kid photos, and product context in parallel
4. **Ephemeral Token**: The response contains `client_secret.value` which is used to authenticate the WebRTC connection
5. **Model**: Uses `gpt-realtime-mini-2025-12-15` for cost efficiency
6. **Voice**: Uses `marin` voice (configurable)

---

## Frontend: Voice Session Hook

**File: `/Users/ashray/code/amxv/kidsway-ai-demo/src/hooks/useVoiceSession.ts`**

This is the core hook that manages the entire voice session lifecycle, including WebRTC connection, audio handling, and tool execution.

### Types

```typescript
export interface TranscriptItem {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export interface UploadUIState {
  isVisible: boolean;
  kidName: string;
  existingPhoto: { imageUrl: string } | null;
}

export interface TryOnResult {
  id: string;
  resultUrl: string;
  kidName: string;
  productTitle?: string;
  remaining?: number;
  timestamp: Date;
}

export interface TryOnError {
  id: string;
  error: string;
  kidName?: string;
  timestamp: Date;
}

export interface TryOnLoadingState {
  kidName?: string;
  productId?: string;
}

export interface VoiceSessionState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;

  // Audio state
  isListening: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  audioLevel: number;

  // Transcript
  userTranscript: string;
  assistantTranscript: string;
  transcriptHistory: TranscriptItem[];

  // Product cards from tool calls
  productCards: AIProductCard[];

  // Virtual try-on UI states
  uploadUIState: UploadUIState | null;
  tryOnLoading: TryOnLoadingState | null;
  tryOnResults: TryOnResult[];
  tryOnErrors: TryOnError[];

  // Rate limit
  secondsUsed: number;
  secondsRemaining: number;
}

export interface VoiceSessionControls {
  start: () => Promise<void>;
  stop: () => void;
  mute: () => void;
  unmute: () => void;
  clearUploadUI: () => void;
  clearTryOnResult: (id: string) => void;
  clearTryOnError: (id: string) => void;
  clearAllTryOns: () => void;
}

export type UseVoiceSessionReturn = VoiceSessionState & VoiceSessionControls;
```

### Hook Structure

```typescript
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { checkVoiceRateLimit, incrementVoiceSeconds } from '@/actions/ai/rate-limits';
import { searchProductsForAI, type AISearchParams } from '@/actions/ai/search';
import { getProductDetails, getProductContextForAI } from '@/actions/storefront/products';
import {
  addToServerCart,
  removeFromServerCart,
  updateServerCartQuantity,
  getServerCart,
} from '@/actions/storefront/cart';
import { createMemory } from '@/actions/ai/memory';
import { getKidPhoto, executeVirtualTryOn } from '@/actions/ai/kid-photos';
import { useDebugStore, isDebugMode } from '@/stores/debug-store';
import { queryKeys } from '@/lib/query-keys';
import type { AIProductCard } from '@/types';

// OpenAI Realtime API WebRTC endpoint
const OPENAI_REALTIME_WEBRTC_URL = 'https://api.openai.com/v1/realtime';

export function useVoiceSession(): UseVoiceSessionReturn {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Connection refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Session timing
  const sessionStartTimeRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isStartingRef = useRef(false);
  const lastStartAttemptRef = useRef<number>(0);

  // ... state declarations ...

  // Response state tracking - to avoid "active response in progress" errors
  const isResponseInProgressRef = useRef(false);

  // ... implementation ...
}
```

### WebRTC Connection Flow (start function)

```typescript
async function start() {
  // Prevent duplicate starts
  setError(null);
  setIsConnecting(true);

  const now = Date.now();
  const timeSinceLastAttempt = now - lastStartAttemptRef.current;

  if (isConnected || isStartingRef.current) {
    console.log('[useVoiceSession] Session already starting/started, skipping');
    setIsConnecting(false);
    return;
  }

  // Prevent rapid successive starts (React Strict Mode protection)
  if (timeSinceLastAttempt < 1000) {
    console.log(`[useVoiceSession] Start attempted too soon, skipping`);
    setIsConnecting(false);
    return;
  }

  isStartingRef.current = true;
  lastStartAttemptRef.current = now;

  try {
    // 1. Check voice rate limit first
    const rateLimitCheck = await checkVoiceRateLimit();
    if (!rateLimitCheck.allowed) {
      throw new Error('Voice time limit reached for today.');
    }
    setSecondsRemaining(rateLimitCheck.remainingSeconds);

    // 2. Request microphone permission
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;

    // 3. Fetch ephemeral token from our API
    const tokenResponse = await fetch('/api/ai/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voice: 'alloy',
        pageContext: pathname,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(errorData.message || 'Failed to create voice session');
    }

    const sessionData = await tokenResponse.json();
    const ephemeralKey = sessionData.client_secret?.value;

    if (!ephemeralKey) {
      throw new Error('Failed to get ephemeral key');
    }

    // 4. Create RTCPeerConnection
    const pc = new RTCPeerConnection();
    peerConnectionRef.current = pc;

    // 5. Set up audio playback for assistant TTS
    const audioEl = new Audio();
    audioEl.autoplay = true;
    audioElementRef.current = audioEl;

    // Track audio playback state
    audioEl.onplaying = () => {
      setIsSpeaking(true);
    };

    // Set up audio output level monitoring
    let audioStopTimeout: ReturnType<typeof setTimeout> | null = null;

    pc.ontrack = (event) => {
      audioEl.srcObject = event.streams[0];

      // Monitor output audio level to detect when AI stops speaking
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(event.streams[0]);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let lastAudioTime = Date.now();

      const checkOutputLevel = () => {
        if (!audioElementRef.current) return;

        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

        if (average > 5) {
          lastAudioTime = Date.now();
          setIsSpeaking(true);

          if (audioStopTimeout) {
            clearTimeout(audioStopTimeout);
            audioStopTimeout = null;
          }
        } else {
          const silenceDuration = Date.now() - lastAudioTime;
          if (silenceDuration > 300 && !audioStopTimeout) {
            audioStopTimeout = setTimeout(() => {
              setIsSpeaking(false);
              audioStopTimeout = null;
            }, 200);
          }
        }

        requestAnimationFrame(checkOutputLevel);
      };
      checkOutputLevel();
    };

    // 6. Create data channel for events
    const dc = pc.createDataChannel('oai-events');
    dataChannelRef.current = dc;

    dc.onopen = () => {
      // Data channel is open
    };

    dc.onmessage = handleDataChannelMessage;

    dc.onerror = (event) => {
      console.error('Data channel error:', event);
    };

    // 7. Add microphone track to peer connection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // 8. Create and send SDP offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // 9. Send offer to OpenAI and get answer
    const sdpResponse = await fetch(
      `${OPENAI_REALTIME_WEBRTC_URL}?model=gpt-realtime-mini-2025-12-15`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      }
    );

    if (!sdpResponse.ok) {
      throw new Error('Failed to establish WebRTC connection');
    }

    const answerSdp = await sdpResponse.text();
    await pc.setRemoteDescription({
      type: 'answer',
      sdp: answerSdp,
    });

    // 10. Start tracking session duration
    sessionStartTimeRef.current = Date.now();
    durationIntervalRef.current = setInterval(() => {
      if (sessionStartTimeRef.current) {
        const elapsed = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
        setSecondsUsed(elapsed);
        setSecondsRemaining((prev) => Math.max(0, 600 - elapsed));

        if (elapsed >= 600) {
          stop();
        }
      }
    }, 1000);

    // 11. Set up audio level monitoring for input
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const checkLevel = () => {
      if (!mediaStreamRef.current) return;
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel(average / 255);
      requestAnimationFrame(checkLevel);
    };
    checkLevel();

    isStartingRef.current = false;

  } catch (err) {
    console.error('Failed to start voice session:', err);
    setError(err instanceof Error ? err : new Error('Failed to start voice session'));
    setIsConnecting(false);
    isStartingRef.current = false;
    stop();
  }
}
```

### Data Channel Message Handler

```typescript
async function handleDataChannelMessage(event: MessageEvent) {
  try {
    const msg = JSON.parse(event.data);

    switch (msg.type) {
      case 'session.created':
        // Session established
        setIsConnected(true);
        setIsConnecting(false);
        break;

      case 'input_audio_buffer.speech_started':
        setIsListening(true);
        setIsSpeaking(false);
        break;

      case 'input_audio_buffer.speech_stopped':
        setIsListening(false);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // User speech transcribed
        if (msg.transcript) {
          setTranscriptHistory((prev) => [
            ...prev,
            {
              role: 'user',
              text: msg.transcript,
              timestamp: new Date(),
            },
          ]);
          setUserTranscript('');
        }
        break;

      case 'response.audio_transcript.delta':
        // Streaming assistant speech transcript
        setAssistantTranscript((prev) => prev + (msg.delta || ''));
        break;

      case 'response.audio_transcript.done':
        // Assistant finished speaking segment
        if (msg.transcript) {
          setTranscriptHistory((prev) => [
            ...prev,
            {
              role: 'assistant',
              text: msg.transcript,
              timestamp: new Date(),
            },
          ]);
        }
        setAssistantTranscript('');
        break;

      case 'response.created':
        // Response started - track state
        isResponseInProgressRef.current = true;
        break;

      case 'response.done':
        // Full response completed - clear state
        isResponseInProgressRef.current = false;
        break;

      case 'response.function_call_arguments.done':
        // Tool call received - execute and send result back
        if (msg.name && msg.arguments) {
          const args = JSON.parse(msg.arguments);
          const toolCallId = msg.call_id || `${msg.name}-${Date.now()}`;

          const result = await executeToolCall(msg.name, args);

          // Send result back to OpenAI
          dataChannelRef.current?.send(
            JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: msg.call_id,
                output: JSON.stringify(result),
              },
            })
          );

          // Only trigger response generation if no response is already in progress
          if (!isResponseInProgressRef.current) {
            dataChannelRef.current?.send(
              JSON.stringify({
                type: 'response.create',
              })
            );
          }
        }
        break;

      case 'error':
        console.error('OpenAI Realtime error:', msg.error);
        const errorMessage = msg.error?.message || 'Voice session error';
        // Suppress "active response in progress" errors
        if (!errorMessage.includes('active response in progress')) {
          setError(new Error(errorMessage));
        }
        break;
    }
  } catch (err) {
    console.error('Error handling data channel message:', err);
  }
}
```

### Tool Execution

```typescript
async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case 'searchProducts': {
      const searchParams: AISearchParams = {
        query: args.query as string | undefined,
        category: args.category as string | undefined,
        brands: args.brands as string[] | undefined,
        colors: args.colors as string[] | undefined,
        ageGroups: args.ageGroups as string[] | undefined,
        gender: args.gender as 'boys' | 'girls' | 'unisex' | undefined,
        minPrice: args.minPrice as number | undefined,
        maxPrice: args.maxPrice as number | undefined,
        sortBy: args.sortBy as 'newest' | 'price_asc' | 'price_desc' | undefined,
        excludeProductIds: args.excludeProductIds as string[] | undefined,
      };

      const result = await searchProductsForAI(searchParams);

      // Update product cards state for UI
      setProductCards(result.products);

      return result;
    }

    case 'getProductInfo': {
      try {
        const productId = args.productId as string;
        const product = await getProductDetails(productId);
        if (!product) {
          return { error: 'Product not found or unavailable' };
        }

        // Auto-navigate to the product page
        const locale = pathname.match(/^\/([a-z]{2})\//)?.[1] || 'en';
        const productUrl = `/${locale}/products/${productId}`;
        router.push(productUrl);

        return {
          id: product.id,
          titleEn: product.titleEn,
          titleAr: product.titleAr,
          descriptionEn: product.descriptionEn,
          descriptionAr: product.descriptionAr,
          salePrice: product.salePrice,
          discountedPrice: product.discountedPrice,
          brand: product.brand?.name || 'Unknown',
          category: product.category?.nameEn || 'Unknown',
          gender: product.gender,
          isInStock: product.variants.some((v) => v.stockQuantity > 0),
          variants: product.variants.map((v) => ({
            id: v.id,
            size: v.size?.label || null,
            color: v.color?.nameEn || null,
            stockQuantity: v.stockQuantity,
            price: v.effectiveSalePrice,
          })),
        };
      } catch (err) {
        return {
          error: 'Failed to get product info',
          message: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    }

    case 'addToCart': {
      try {
        await addToServerCart(
          args.variantId as string,
          (args.quantity as number) || 1
        );
        queryClient.invalidateQueries({ queryKey: queryKeys.cart.all, refetchType: 'all' });
        return {
          success: true,
          message: `Added ${(args.quantity as number) || 1} item(s) to your cart.`,
        };
      } catch (err) {
        return {
          success: false,
          message: 'Failed to add item to cart.',
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    }

    case 'removeFromCart': {
      try {
        const variantId = args.variantId as string;
        const quantityToRemove = args.quantity as number | undefined;

        if (quantityToRemove === undefined) {
          await removeFromServerCart(variantId);
          queryClient.invalidateQueries({ queryKey: queryKeys.cart.all, refetchType: 'all' });
          return { success: true, message: 'Item removed from your cart.' };
        }

        const cartItems = await getServerCart();
        const cartItem = cartItems.find((item) => item.variantId === variantId);

        if (!cartItem) {
          return { success: false, message: 'Item not found in cart.' };
        }

        const newQuantity = cartItem.quantity - quantityToRemove;

        if (newQuantity <= 0) {
          await removeFromServerCart(variantId);
        } else {
          await updateServerCartQuantity(variantId, newQuantity);
        }

        queryClient.invalidateQueries({ queryKey: queryKeys.cart.all, refetchType: 'all' });
        return {
          success: true,
          message: newQuantity <= 0
            ? 'Item removed from your cart.'
            : `Removed ${quantityToRemove} item(s). ${newQuantity} remaining in cart.`,
        };
      } catch (err) {
        return {
          success: false,
          message: 'Failed to remove item from cart.',
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    }

    case 'viewCart': {
      const cartItems = await getServerCart();
      return {
        items: cartItems.map((item) => ({
          variantId: item.variantId,
          productName: item.product.titleEn,
          brand: item.brand?.name || null,
          size: item.variant.size?.label || null,
          color: item.variant.color?.nameEn || null,
          quantity: item.quantity,
          price: item.variant.effectiveSalePrice,
          imageUrl: item.imageUrl,
        })),
        subtotal: cartItems
          .reduce((sum, item) => {
            const price = parseFloat(item.variant.effectiveSalePrice);
            return sum + price * item.quantity;
          }, 0)
          .toFixed(2),
        itemCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
      };
    }

    case 'createMemory': {
      try {
        await createMemory({
          content: args.content as string,
          category: args.category as string,
        });
        return { success: true };
      } catch {
        return { success: false };
      }
    }

    case 'showUploadUI': {
      const kidNameRaw = args.kidName as string;
      const normalizedName = kidNameRaw.toLowerCase().trim().replace(/\s+/g, '-');

      try {
        const existingPhoto = await getKidPhoto(normalizedName);

        setUploadUIState({
          isVisible: true,
          kidName: normalizedName,
          existingPhoto: existingPhoto ? { imageUrl: existingPhoto.imageUrl } : null,
        });

        return {
          success: true,
          uiAction: 'showUploadUI',
          kidName: normalizedName,
          existingPhoto: existingPhoto ? { imageUrl: existingPhoto.imageUrl } : null,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Failed to show upload UI',
        };
      }
    }

    case 'virtualTryOn': {
      const kidNameRaw = args.kidName as string;
      const normalizedName = kidNameRaw.toLowerCase().trim().replace(/\s+/g, '-');
      const productId = args.productId as string;
      const tryOnId = `tryon-${Date.now()}`;

      // Show loading state
      setTryOnLoading({ kidName: normalizedName, productId });

      try {
        const result = await executeVirtualTryOn(productId, normalizedName);

        setTryOnLoading(null);

        if (result.success && result.resultUrl) {
          setTryOnResults(prev => [{
            id: tryOnId,
            resultUrl: result.resultUrl!,
            kidName: result.kidName || normalizedName,
            productTitle: result.productTitle,
            remaining: result.remaining,
            timestamp: new Date(),
          }, ...prev]);
        } else {
          setTryOnErrors(prev => [{
            id: tryOnId,
            error: result.error || 'Try-on generation failed',
            kidName: normalizedName,
            timestamp: new Date(),
          }, ...prev]);
        }

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred';

        setTryOnLoading(null);
        setTryOnErrors(prev => [{
          id: tryOnId,
          error: errorMsg,
          kidName: normalizedName,
          timestamp: new Date(),
        }, ...prev]);

        return { success: false, error: errorMsg };
      }
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
```

### Page Context Updates

The hook also watches for page navigation and sends context updates to the AI:

```typescript
// Watch for page changes and send context updates to the AI
useEffect(() => {
  if (!isConnected || !dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
    return;
  }

  const currentProductId = extractProductIdFromPath(pathname);

  if (currentProductId === lastProductIdRef.current) {
    return;
  }

  lastProductIdRef.current = currentProductId;

  if (!currentProductId) {
    // User navigated away from product page
    dataChannelRef.current.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: '[SYSTEM: User navigated away from product page - they are now browsing the store]',
            },
          ],
        },
      })
    );
    return;
  }

  // Fetch product context and send to AI
  getProductContextForAI(currentProductId).then((productContext) => {
    if (!productContext || !dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      return;
    }

    const contextMessage = `[SYSTEM: User is now viewing a different product]

CURRENT PRODUCT CONTEXT:
- Product ID: ${currentProductId}
- Name: ${productContext.titleEn}
- Brand: ${productContext.brandName}
- Category: ${productContext.categoryNameEn}
- Price: ${productContext.salePrice} Saudi Riyal
- Available Sizes: ${productContext.availableSizes.join(', ')}
- Available Colors: ${productContext.availableColors.map(c => c.nameEn).join(', ')}
- In Stock: ${productContext.isInStock ? 'Yes' : 'No'}

Use this product ID (${currentProductId}) for any cart or try-on operations.`;

    dataChannelRef.current.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: contextMessage }],
        },
      })
    );
  });
}, [pathname, isConnected]);
```

---

## Tool Definitions for Real-time API

**File: `/Users/ashray/code/amxv/kidsway-ai-demo/src/lib/ai/tools.ts`**

OpenAI's Real-time API requires tools in a specific format different from Vercel AI SDK:

```typescript
export interface OpenAITool {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export const openAIRealtimeTools: OpenAITool[] = [
  {
    type: 'function',
    name: 'searchProducts',
    description: 'Search for products in the store. Returns product information including name, brand, and price.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search text to match product names and descriptions',
        },
        category: {
          type: 'string',
          description: 'Filter by category name (e.g., "Dresses", "Tops", "Sneakers")',
        },
        brands: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by brand names',
        },
        gender: {
          type: 'string',
          enum: ['boys', 'girls', 'unisex'],
          description: 'Filter by gender',
        },
        colors: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by color names',
        },
        ageGroups: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by age group names (e.g., "Toddler", "Kids")',
        },
        minPrice: { type: 'number', description: 'Minimum price filter' },
        maxPrice: { type: 'number', description: 'Maximum price filter' },
        excludeProductIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Product IDs to exclude',
        },
        sortBy: {
          type: 'string',
          enum: ['newest', 'price_asc', 'price_desc'],
          description: 'Sort order for results',
        },
      },
      required: [],
    },
  },
  {
    type: 'function',
    name: 'getProductInfo',
    description: 'Get detailed information about a specific product including sizes, colors, and availability.',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'The product ID to get information for',
        },
      },
      required: ['productId'],
    },
  },
  {
    type: 'function',
    name: 'addToCart',
    description: "Add a product to the user's shopping cart. Requires the variant ID.",
    parameters: {
      type: 'object',
      properties: {
        variantId: {
          type: 'string',
          description: 'The product variant ID to add to cart',
        },
        quantity: {
          type: 'number',
          description: 'Quantity to add (default 1)',
        },
      },
      required: ['variantId'],
    },
  },
  {
    type: 'function',
    name: 'removeFromCart',
    description: "Remove item(s) from the user's shopping cart.",
    parameters: {
      type: 'object',
      properties: {
        variantId: {
          type: 'string',
          description: 'The variant ID to remove from cart',
        },
        quantity: {
          type: 'number',
          description: 'Number of items to remove. If not specified, removes all.',
        },
      },
      required: ['variantId'],
    },
  },
  {
    type: 'function',
    name: 'viewCart',
    description: 'View the current contents of the shopping cart.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    type: 'function',
    name: 'createMemory',
    description: "REQUIRED: Save user info to database. MUST call when user shares personal details.",
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: "Info to save, e.g., 'Son Ahmed: 8 years, likes sporty'",
        },
      },
      required: ['content'],
    },
  },
  {
    type: 'function',
    name: 'showUploadUI',
    description: "Show the photo upload interface for virtual try-on.",
    parameters: {
      type: 'object',
      properties: {
        kidName: {
          type: 'string',
          description: "The child's name (first name only).",
        },
      },
      required: ['kidName'],
    },
  },
  {
    type: 'function',
    name: 'virtualTryOn',
    description: 'Generate a virtual try-on image. May take up to 60 seconds.',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'The product ID to try on',
        },
        kidName: {
          type: 'string',
          description: "The child's name whose photo to use",
        },
      },
      required: ['productId', 'kidName'],
    },
  },
];
```

---

## UI Components

### VoiceModePanel

**File: `/Users/ashray/code/amxv/kidsway-ai-demo/src/components/storefront/ai/VoiceModePanel.tsx`**

The main voice interface component:

```typescript
'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { X, Mic, MicOff, PhoneOff, Loader2, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatUIStore } from '@/stores/chat-ui-store';
import { useDebugStore, isDebugMode } from '@/stores/debug-store';
import { useVoiceSession } from '@/hooks/useVoiceSession';
import { VoiceVisualizer } from './VoiceVisualizer';
import { AIProductCardGrid } from './AIProductCard';
import { KidPhotoUploadUI } from './KidPhotoUploadUI';
import { TryOnResultUI, TryOnErrorUI, TryOnLoadingUI } from './TryOnResultUI';

export function VoiceModePanel() {
  const locale = useLocale();
  const t = useTranslations('ai');
  const isRTL = locale === 'ar';

  const { setVoiceMode } = useChatUIStore();

  const {
    isConnected,
    isConnecting,
    error,
    isListening,
    isSpeaking,
    isMuted,
    audioLevel,
    productCards,
    uploadUIState,
    tryOnLoading,
    tryOnResults,
    tryOnErrors,
    secondsUsed,
    secondsRemaining,
    start,
    stop,
    mute,
    unmute,
    clearUploadUI,
    clearTryOnResult,
    clearTryOnError,
  } = useVoiceSession();

  // Auto-start on mount
  useEffect(() => {
    start();
  }, []);

  const handleClose = () => {
    stop();
    setVoiceMode(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn(
      'flex flex-col bg-background rounded-lg shadow-2xl border overflow-hidden',
      'w-full h-full'
    )} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <h2 className="font-semibold text-sm">{t('voice.title')}</h2>
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground">
            {formatTime(secondsRemaining)} left
          </div>
          <Button variant="ghost" size="icon-sm" onClick={handleClose}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Error state */}
        {error && (
          <div className="p-4 bg-destructive/10 border-b border-destructive/20">
            <p className="text-sm text-destructive text-center">{error.message}</p>
            <div className="flex justify-center mt-2">
              <Button size="sm" variant="outline" onClick={start}>Retry</Button>
            </div>
          </div>
        )}

        {/* Visualizer */}
        <div className="flex flex-col items-center justify-center py-2 border-b">
          <VoiceVisualizer
            audioLevel={audioLevel}
            isListening={isListening}
            isSpeaking={isSpeaking}
            isConnecting={isConnecting}
            isConnected={isConnected}
            error={error}
          />
        </div>

        {/* Tool Results Section */}
        <div className="flex-1 overflow-y-auto">
          {/* Product cards */}
          {productCards.length > 0 && (
            <div className="border-t p-4">
              <AIProductCardGrid products={productCards} />
            </div>
          )}

          {/* Upload UI */}
          {uploadUIState?.isVisible && (
            <div className="border-t p-4">
              <KidPhotoUploadUI
                kidName={uploadUIState.kidName}
                existingPhoto={uploadUIState.existingPhoto}
                onUploadComplete={clearUploadUI}
                onDelete={clearUploadUI}
              />
            </div>
          )}

          {/* Try-on Loading */}
          {tryOnLoading && (
            <div className="border-t p-4">
              <TryOnLoadingUI />
            </div>
          )}

          {/* Try-on Results */}
          {tryOnResults.map((result) => (
            <div key={result.id} className="p-4 border-b space-y-2">
              <TryOnResultUI
                resultUrl={result.resultUrl}
                kidName={result.kidName}
                productTitle={result.productTitle}
                remaining={result.remaining}
              />
              <Button variant="ghost" size="sm" onClick={() => clearTryOnResult(result.id)}>
                Remove
              </Button>
            </div>
          ))}

          {/* Try-on Errors */}
          {tryOnErrors.map((err) => (
            <div key={err.id} className="p-4 border-b space-y-2">
              <TryOnErrorUI error={err.error} kidName={err.kidName} />
              <Button variant="ghost" size="sm" onClick={() => clearTryOnError(err.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 p-4 border-t bg-muted/30">
        <Button
          variant={isMuted ? 'destructive' : 'outline'}
          size="lg"
          onClick={isMuted ? unmute : mute}
          disabled={!isConnected || isConnecting}
          className="gap-2"
        >
          {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
          <span>{isMuted ? t('voice.unmute') : t('voice.mute')}</span>
        </Button>

        <Button
          variant="destructive"
          size="lg"
          onClick={handleClose}
          className="gap-2"
        >
          <PhoneOff className="size-5" />
          <span>{t('voice.endSession')}</span>
        </Button>
      </div>
    </div>
  );
}
```

### VoiceVisualizer

**File: `/Users/ashray/code/amxv/kidsway-ai-demo/src/components/storefront/ai/VoiceVisualizer.tsx`**

Animated visual feedback for audio state:

```typescript
'use client';

import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface VoiceVisualizerProps {
  audioLevel: number; // 0-1
  isListening: boolean;
  isSpeaking: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  error: Error | null;
}

export function VoiceVisualizer({
  audioLevel,
  isListening,
  isSpeaking,
  isConnecting,
  isConnected,
  error,
}: VoiceVisualizerProps) {
  const baseScale = (isSpeaking || isConnecting) ? Math.max(audioLevel, 0.4) : audioLevel;
  const scale = 1 + baseScale * 0.8;
  const isActive = isListening || isSpeaking || isConnecting;

  const [pulseScale, setPulseScale] = useState(1);

  useEffect(() => {
    if (isSpeaking || isListening || isConnecting) {
      let frame = 0;
      const interval = setInterval(() => {
        frame += 0.15;
        setPulseScale(1 + Math.sin(frame) * 0.2);
      }, 30);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isSpeaking, isListening, isConnecting]);

  const effectivePulseScale = (isSpeaking || isListening || isConnecting) ? pulseScale : 1;

  return (
    <div className="relative flex items-center justify-center py-2">
      {/* Outermost glow ring */}
      <div
        className={cn(
          'absolute size-28 rounded-full transition-all duration-500 ease-out blur-2xl',
          isConnecting && 'bg-muted/30',
          !isConnecting && isListening && 'bg-primary/30 animate-pulse',
          !isConnecting && isSpeaking && 'bg-green-400/30 animate-pulse',
          !isActive && 'bg-muted/20'
        )}
        style={{ transform: `scale(${isActive ? scale * effectivePulseScale + 0.2 : 1})` }}
      />

      {/* Outer glow ring */}
      <div
        className={cn(
          'absolute size-24 rounded-full transition-all duration-300 blur-xl',
          isConnecting && 'bg-muted/40',
          !isConnecting && isListening && 'bg-primary/40',
          !isConnecting && isSpeaking && 'bg-green-500/40',
          !isActive && 'bg-muted/25'
        )}
        style={{ transform: `scale(${isActive ? scale * effectivePulseScale + 0.15 : 1})` }}
      />

      {/* Middle ring */}
      <div
        className={cn(
          'absolute size-18 rounded-full transition-all duration-200 shadow-2xl',
          isConnecting && 'bg-muted/50',
          !isConnecting && isListening && 'bg-primary/50',
          !isConnecting && isSpeaking && 'bg-green-500/50',
          !isActive && 'bg-muted/30'
        )}
        style={{ transform: `scale(${isActive ? scale * effectivePulseScale + 0.1 : 1})` }}
      />

      {/* Inner circle with icon */}
      <div
        className={cn(
          'relative size-14 rounded-full flex items-center justify-center transition-all duration-150 shadow-2xl',
          isConnecting && 'bg-gradient-to-br from-muted to-muted/80',
          !isConnecting && isListening && 'bg-gradient-to-br from-primary to-primary/80',
          !isConnecting && isSpeaking && 'bg-gradient-to-br from-green-400 to-green-600',
          !isActive && 'bg-gradient-to-br from-muted-foreground/10 to-muted-foreground/20'
        )}
        style={{ transform: `scale(${isActive ? scale * effectivePulseScale : 1})` }}
      >
        {!isConnecting && isConnected && !error ? (
          // Mic or speaker icon based on state
          isListening ? (
            <MicIcon className="size-6 text-primary-foreground" />
          ) : isSpeaking ? (
            <SpeakerIcon className="size-6 text-white" />
          ) : (
            <MicIcon className="size-6 text-muted-foreground" />
          )
        ) : (
          // Loading spinner
          <LoadingSpinner className="size-6 animate-spin" />
        )}
      </div>

      {/* Audio level bars (left and right) */}
      {isActive && (
        <>
          <div className="absolute -left-20 flex items-center gap-1">
            {[...Array(5)].map((_, i) => {
              const barLevel = Math.max(0, baseScale * effectivePulseScale - i * 0.15);
              return (
                <div
                  key={i}
                  className={cn(
                    'w-1 rounded-full transition-all duration-100 shadow-lg',
                    isListening ? 'bg-primary' : 'bg-green-500'
                  )}
                  style={{
                    height: `${12 + barLevel * 30}px`,
                    opacity: 0.5 + barLevel * 0.5,
                    transitionDelay: `${i * 50}ms`,
                  }}
                />
              );
            })}
          </div>
          <div className="absolute -right-20 flex items-center gap-1">
            {/* Mirror of left bars */}
          </div>
        </>
      )}
    </div>
  );
}
```

---

## State Management

### Chat UI Store

**File: `/Users/ashray/code/amxv/kidsway-ai-demo/src/stores/chat-ui-store.ts`**

```typescript
import { create } from 'zustand';

export interface ChatUIState {
  isOpen: boolean;
  isSidebarOpen: boolean;
  activeConversationId: string | null;
  isVoiceMode: boolean;
  isAwaitingResponse: boolean;
}

export interface ChatUIActions {
  open: () => void;
  close: () => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  setActiveConversation: (id: string | null) => void;
  setVoiceMode: (enabled: boolean) => void;
  setAwaitingResponse: (awaiting: boolean) => void;
  reset: () => void;
}

const initialState: ChatUIState = {
  isOpen: false,
  isSidebarOpen: false,
  activeConversationId: null,
  isVoiceMode: false,
  isAwaitingResponse: false,
};

export const useChatUIStore = create<ChatUIStore>((set) => ({
  ...initialState,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  closeSidebar: () => set({ isSidebarOpen: false }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setVoiceMode: (enabled) => set({ isVoiceMode: enabled }),
  setAwaitingResponse: (awaiting) => set({ isAwaitingResponse: awaiting }),
  reset: () => set(initialState),
}));
```

### Debug Store (for development)

**File: `/Users/ashray/code/amxv/kidsway-ai-demo/src/stores/debug-store.ts`**

The debug store tracks voice sessions, tool calls, and transcripts for the DevDebugPanel:

```typescript
export interface VoiceSessionTranscript {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  transcript: VoiceTranscriptItem[];
  toolCalls: ToolCallDebug[];
  pageContextUpdates: PageContextUpdate[];
  systemPrompt?: string;
  availableTools?: ToolDefinition[];
  pageContext?: string;
  kidPhotos?: string;
}

// Actions for voice debug
startVoiceSession: (sessionId, debugInfo) => set({
  currentVoiceSession: {
    sessionId,
    startTime: new Date(),
    transcript: [],
    toolCalls: [],
    pageContextUpdates: [],
    systemPrompt: debugInfo?.systemPrompt,
    availableTools: debugInfo?.availableTools,
    pageContext: debugInfo?.pageContext,
    kidPhotos: debugInfo?.kidPhotos,
  },
}),

endVoiceSession: () => set((state) => {
  if (!state.currentVoiceSession) return state;

  const completedSession = {
    ...state.currentVoiceSession,
    endTime: new Date(),
  };

  return {
    voiceTranscripts: [completedSession, ...state.voiceTranscripts].slice(0, 10),
    currentVoiceSession: null,
  };
}),

addVoiceTranscript: (item) => set((state) => {
  if (!state.currentVoiceSession) return state;
  return {
    currentVoiceSession: {
      ...state.currentVoiceSession,
      transcript: [...state.currentVoiceSession.transcript, { ...item, timestamp: new Date() }],
    },
  };
}),
```

---

## System Prompt for Voice

**File: `/Users/ashray/code/amxv/kidsway-ai-demo/src/lib/ai/system-prompt.ts`**

The voice system prompt is optimized for spoken conversation:

```typescript
export function buildVoiceSystemPrompt(
  memories: string,
  pageContext?: string,
  locale: string = 'en',
  productContext?: ProductContext,
  kidPhotos?: string
): string {
  const baseVoicePrompt = `You are Kidsway AI, a warm and friendly voice shopping assistant...

## VOICE INTERACTION GUIDELINES
- Speak naturally - like chatting with a friend
- Keep responses conversational (1-3 sentences per turn)
- Ask follow-up questions to understand their needs
- IMPORTANT: Call tools first, THEN respond with results
- NEVER use markdown - speak in plain text only
- NEVER recite product IDs or technical identifiers
- ALWAYS use Saudi Riyal for prices - never say "SAR"

## AVAILABLE TOOLS
[Tool definitions...]

## VIRTUAL TRY-ON
### CRITICAL - Single Child Rule:
If KID PHOTOS section shows EXACTLY ONE child, use that child IMMEDIATELY...

## USER MEMORIES
${memories}`;

  let prompt = baseVoicePrompt;

  // Add locale preference
  if (locale === 'ar') {
    prompt += `\n\n## LANGUAGE\nPrimary language: Arabic...`;
  }

  // Add product context if available
  if (productContext) {
    prompt += `\n\n## CONTEXT\n${formatProductContextForVoice(productContext, locale)}`;
  }

  // Add kid photos if available
  if (kidPhotos) {
    prompt += `\n\n## KID PHOTOS FOR VIRTUAL TRY-ON\n${kidPhotos}`;
  }

  return prompt;
}
```

---

## Rate Limiting

**File: `/Users/ashray/code/amxv/kidsway-ai-demo/src/actions/ai/rate-limits.ts`**

Voice sessions are rate-limited by seconds per day:

```typescript
// Rate limit constants
export const AI_RATE_LIMITS = {
  TEXT_MESSAGES_PER_DAY: 1000,
  VOICE_SECONDS_PER_DAY: 6000,  // 100 minutes
  VOICE_SECONDS_PER_DAY_AGENTDUNE: 60000,  // 1000 minutes for internal users
} as const;

export async function checkVoiceRateLimit(): Promise<{
  allowed: boolean;
  remainingSeconds: number;
}> {
  const user = await getSessionUser();
  if (!user) {
    return { allowed: false, remainingSeconds: 0 };
  }

  const status = await getRateLimitStatus();

  return {
    allowed: status.voiceSecondsRemaining > 0,
    remainingSeconds: status.voiceSecondsRemaining,
  };
}

export async function incrementVoiceSeconds(seconds: number): Promise<{
  allowed: boolean;
  status: AIRateLimitStatus;
}> {
  const user = await getSessionUser();
  if (!user) throw new Error('You must be logged in');

  if (seconds <= 0) {
    const status = await getRateLimitStatus();
    return { allowed: true, status };
  }

  const today = getTodayUTC();

  // Upsert with atomic increment
  await db
    .insert(aiRateLimits)
    .values({
      id: nanoid(),
      userId: user.id,
      date: today,
      textMessageCount: 0,
      voiceSeconds: seconds,
    })
    .onConflictDoUpdate({
      target: [aiRateLimits.userId, aiRateLimits.date],
      set: {
        voiceSeconds: sql`${aiRateLimits.voiceSeconds} + ${seconds}`,
        updatedAt: new Date(),
      },
    });

  const status = await getRateLimitStatus();
  const allowed = status.voiceSecondsUsed <= status.voiceSecondsLimit;

  return { allowed, status };
}
```

---

## How Everything Connects

### Connection Flow

1. **User clicks voice button** in ChatWindow
   - `setVoiceMode(true)` triggers VoiceModePanel to render

2. **VoiceModePanel mounts**
   - Calls `useVoiceSession()` hook
   - Hook's `useEffect` calls `start()`

3. **start() function**
   - Checks rate limits
   - Requests microphone permission
   - Fetches ephemeral token from `/api/ai/session`
   - Creates RTCPeerConnection
   - Creates data channel for events
   - Exchanges SDP offer/answer with OpenAI
   - Starts audio level monitoring

4. **Voice interaction**
   - User speaks -> Microphone audio sent via WebRTC
   - OpenAI transcribes and responds
   - Events received on data channel:
     - `input_audio_buffer.speech_started` -> isListening = true
     - `response.function_call_arguments.done` -> Execute tool, send result
     - `response.audio_transcript.done` -> Add to transcript history

5. **Tool execution**
   - AI calls a tool (e.g., searchProducts)
   - Hook executes tool via server actions
   - Result sent back via data channel
   - AI responds with natural language

6. **Session end**
   - User clicks "End Session"
   - `stop()` closes WebRTC connection
   - Voice seconds incremented in database
   - UI returns to chat mode

### Key Architecture Decisions

1. **Ephemeral Tokens**: The server creates short-lived tokens so the real API key never reaches the client

2. **Client-side Tool Execution**: Tools are executed on the client using server actions, allowing UI updates (like showing product cards)

3. **Page Context Updates**: The hook watches for navigation and sends context updates to the AI in real-time

4. **Rate Limiting**: Voice seconds are tracked to limit usage per user per day

5. **Debug Panel**: Development mode includes a comprehensive debug panel showing transcripts, tool calls, and system prompts

---

## Files Summary

| File | Purpose |
|------|---------|
| `src/app/api/ai/session/route.ts` | Creates ephemeral session tokens |
| `src/hooks/useVoiceSession.ts` | WebRTC connection and tool execution |
| `src/lib/ai/tools.ts` | Tool definitions in OpenAI format |
| `src/lib/ai/system-prompt.ts` | Voice-optimized prompt builder |
| `src/components/storefront/ai/VoiceModePanel.tsx` | Main voice UI |
| `src/components/storefront/ai/VoiceVisualizer.tsx` | Audio visualization |
| `src/components/storefront/ai/ChatWindow.tsx` | Container with voice mode toggle |
| `src/components/storefront/ai/ChatWidget.tsx` | Top-level widget |
| `src/stores/chat-ui-store.ts` | UI state (voice mode toggle) |
| `src/stores/debug-store.ts` | Development debug tracking |
| `src/actions/ai/rate-limits.ts` | Voice seconds rate limiting |
| `src/actions/ai/search.ts` | Product search for AI |
| `src/actions/ai/kid-photos.ts` | Virtual try-on support |
| `src/types.ts` | TypeScript type definitions |

---

## Environment Variables Required

```env
OPENAI_API_KEY=sk-...
```

---

## Model and Voice Configuration

- **Model**: `gpt-realtime-mini-2025-12-15`
- **Voice**: `marin` (configurable to: alloy, ash, ballad, coral, echo, marin, sage, shimmer, verse)
- **Modalities**: `['audio', 'text']`
- **Tool Choice**: `auto`

---

This implementation provides a complete, production-ready voice agent with:
- Real-time bidirectional audio
- Tool calling for product search, cart management, and virtual try-on
- Page context awareness
- Rate limiting
- Multi-language support (English/Arabic)
- Development debugging tools
