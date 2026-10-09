package com.physiocare.clinic.dto.common;

import java.util.List;

/** Stable response envelope for screens that render large server-side lists. */
public record PageResponse<T>(
    List<T> items,
    int page,
    int size,
    long totalItems,
    int totalPages,
    boolean hasNext,
    boolean hasPrevious) {
  public static <T> PageResponse<T> of(List<T> items, int page, int size, long totalItems) {
    int pages = (int) Math.ceil(totalItems / (double) size);
    return new PageResponse<>(items, page, size, totalItems, pages, page + 1 < pages, page > 0);
  }

  public static int offset(int page, int size) {
    return Math.max(page, 0) * Math.max(size, 1);
  }

  public static int size(int requested) {
    return Math.min(Math.max(requested, 1), 100);
  }
}
