package br.com.zonasulurgente.api.news.admin;

import java.util.List;

/** Paginação numérica do painel. */
public record AdminPage<T>(List<T> items, long total, int page, int pageCount) {
}
