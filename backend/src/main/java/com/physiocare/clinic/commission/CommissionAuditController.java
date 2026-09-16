package com.physiocare.clinic.commission;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** HTTP adapter for the commission audit trail. */
@RestController
@RequestMapping("/api/v1/commission/audit")
@PreAuthorize("@permissionGuard.hasAny(authentication, 'commission.view.all')")
public class CommissionAuditController {
  private final CommissionAuditQueryService service;
  public CommissionAuditController(CommissionAuditQueryService service){this.service=service;}
  @GetMapping
  public List<Map<String,Object>> list(@RequestParam(required=false) String entityType,
      @RequestParam(required=false) String action,@RequestParam(required=false) OffsetDateTime from,
      @RequestParam(required=false) OffsetDateTime to){return service.list(entityType,action,from,to);}
}
