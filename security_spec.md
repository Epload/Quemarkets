# Mercao Security Specification (Phase 0)

## 1. Data Invariants
1. **UserProfile (`/users/{userId}`)**: Only the authenticated, email-verified owner (`request.auth.uid == userId`) can read, create, or update their profile. `uid` is immutable and must equal `request.auth.uid`. `customCategories` is bounded to max 12 items.
2. **Listing (`/listings/{listingId}`)**: Publicly readable catalog items containing zero PII. Only verified authenticated users can create listings with `sellerId == request.auth.uid` and `status == 'active'`. Only the seller can edit or mark a listing `'sold'` (terminal state lock once `'sold'`). `createdAt` and `sellerId` are immutable.
3. **ChatThread (`/chats/{chatId}`)**: Strictly private to the 2 participants (`buyerId`, `sellerId`, stored in `participantIds` of length 2). Only verified participants can read, list, create (as `buyerId`), or update (`lastMessage`, `lastMessageAt`).
4. **ChatMessage (`/chats/{chatId}/messages/{messageId}`)**: Governed by the Master Gate (`get(/databases/$(database)/documents/chats/$(chatId))`). Only verified members of the parent chat (`request.auth.uid in parent.participantIds`) can read or create messages with `senderId == request.auth.uid` and `participantIds == parent.participantIds`. Messages are immutable.
5. **Purchase (`/purchases/{purchaseId}`)**: Only `buyerId` or `sellerId` can read or list a purchase record. Only verified `buyerId` can create a purchase referencing an existing `listings/{listingId}` document with `status == 'completed'`. Immutable after creation.

## 2. Dirty Dozen Adversarial Payloads
1. Unauthenticated write to `/listings/test1` -> `PERMISSION_DENIED`
2. Unverified email write (`email_verified: false`) to `/listings/test1` -> `PERMISSION_DENIED`
3. Spoofed `sellerId` (`sellerId: "victim"`) on `/listings/test2` -> `PERMISSION_DENIED`
4. Shadow field (`isFeatured: true`) injected into `/listings/test3` -> `PERMISSION_DENIED`
5. 1MB junk ID (`/listings/<1500 chars>`) -> `PERMISSION_DENIED`
6. Forged client `createdAt` timestamp (`createdAt != request.time`) -> `PERMISSION_DENIED`
7. Updating a listing after `status == 'sold'` (terminal state bypass) -> `PERMISSION_DENIED`
8. Unbounded `customCategories` array (> 12 entries) on `/users/u1` -> `PERMISSION_DENIED`
9. Non-owner reading `/users/victim` profile -> `PERMISSION_DENIED`
10. Third-party reading or listing `/chats/chat1` where `uid` not in `participantIds` -> `PERMISSION_DENIED`
11. Sending a `/chats/chat1/messages/m1` with mismatched `senderId` or without parent membership -> `PERMISSION_DENIED`
12. Creating `/purchases/p1` referencing a non-existent `listingId` -> `PERMISSION_DENIED`
