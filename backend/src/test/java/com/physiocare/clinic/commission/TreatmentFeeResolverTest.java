package com.physiocare.clinic.commission;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
class TreatmentFeeResolverTest {
  @Mock JdbcTemplate db;
  private TreatmentFeeResolver resolver;

  @BeforeEach void setUp() { resolver = new TreatmentFeeResolver(db); }

  @Test void ownerTreatingSelfDoesNotQueryOrCreateFee() {
    assertThat(resolver.resolve(7, 7, 1L, LocalDate.of(2026, 8, 1))).isEmpty();
  }

  @Test void noMatchingRuleReturnsEmpty() {
    when(db.queryForList("SELECT staff_type FROM staff WHERE id=?", String.class, 8L)).thenReturn(List.of("PT"));
    when(db.queryForList(any(String.class), any(Object[].class))).thenReturn(List.of());
    assertThat(resolver.resolve(8, 7, 1L, LocalDate.of(2026, 8, 1))).isEmpty();
  }

  @Test void mostSpecificEmployeeAndServiceRuleWins() {
    when(db.queryForList("SELECT staff_type FROM staff WHERE id=?", String.class, 8L)).thenReturn(List.of("PT"));
    Map<String, Object> broad = Map.of("id", 1L, "employee_id", 8L, "fee_type", "FIXED", "fee_value", new BigDecimal("20"));
    Map<String, Object> specific = Map.of("id", 2L, "employee_id", 8L, "service_id", 3L, "fee_type", "FIXED", "fee_value", new BigDecimal("45"));
    when(db.queryForList(any(String.class), eq(LocalDate.of(2026, 8, 1)), eq(LocalDate.of(2026, 8, 1)), eq(8L), eq("PT"), eq(3L)))
        .thenReturn(List.of(broad, specific));
    var result = resolver.resolve(8, 7, 3L, LocalDate.of(2026, 8, 1));
    assertThat(result).isPresent().get().extracting(TreatmentFeeResolver.Resolution::ruleId).isEqualTo(2L);
  }
}
