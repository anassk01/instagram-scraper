// src/types.d.ts

// Extend the Window interface to include our dynamic properties
interface Window {
    [key: string]: any; // Allow dynamic property access
  }