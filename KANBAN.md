# TONEGLYPH ENGINE — KANBAN

**Last Updated:** 2026-04-15  

---

## BACKLOG
| Ticket | Title | Priority | Assignee | Depends On |
|--------|-------|----------|----------|------------|
| 004 | Pillars 1, 2, 4 (LLM) | P1 | Clode | 003 |
| 005 | Pillar 5 (Fingerprint) | P1 | Clode | 002 |
| 007 | Visualization (Frontend) | P1 | Clode | 006 |

## READY
| Ticket | Title | Priority | Assignee | Depends On |
|--------|-------|----------|----------|------------|
| 001 | Project Scaffold | P0 | Clode | — |

## IN PROGRESS
| Ticket | Title | Priority | Assignee | Started |
|--------|-------|----------|----------|---------|
| — | — | — | — | — |

## QA / REVIEW
| Ticket | Title | Reviewer | Notes |
|--------|-------|----------|-------|
| — | — | — | — |

## DONE
| Ticket | Title | Completed | Notes |
|--------|-------|-----------|-------|
| — | — | — | — |

---

## BLOCKED
| Ticket | Title | Blocked By | Notes |
|--------|-------|------------|-------|
| 002 | Audio Ingestion | 001 | Needs scaffold first |
| 003 | Pillar 3 (Music Theory) | 002 | Needs ingestion pipeline |
| 006 | Color Encoding Module | 003, 004, 005 | Needs all pillar outputs |
| 008 | E2E Integration + Deploy | All | Final milestone |

---

## CRITICAL PATH
```
001 → 002 → 003 → 004 (parallel with 005) → 006 → 007 → 008
                                                      ↑
                                              Gemini review gate
```

## GEMINI CHECKPOINTS
- [ ] TICKET-003: MIR feature selection review
- [ ] TICKET-006: Color encoding math review (CRITICAL)
- [ ] TICKET-004: Prompt engineering review
