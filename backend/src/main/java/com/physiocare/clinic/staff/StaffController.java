package com.physiocare.clinic.staff;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/v1/staff") public class StaffController {
    private final StaffService service; public StaffController(StaffService s){service=s;}
    @PostMapping public StaffDtos.CreateResponse create(@Valid @RequestBody StaffDtos.CreateRequest r){return service.create(r);}
    @GetMapping public java.util.List<StaffDtos.Row> list(){return service.listActive();}
    @DeleteMapping("/by-email/{email}")
    public void softDelete(@PathVariable String email) { service.softDeleteByEmail(email); }
}
