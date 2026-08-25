package com.physiocare.clinic.branch;
import jakarta.validation.Valid; import org.springframework.http.HttpStatus; import org.springframework.web.bind.annotation.*; import org.springframework.web.server.ResponseStatusException;
import java.util.List; import java.util.concurrent.ConcurrentHashMap; import java.util.concurrent.atomic.AtomicLong;
@RestController @RequestMapping("/api/branches") public class BranchController {
 private final ConcurrentHashMap<Long,Branch> branches=new ConcurrentHashMap<>(); private final AtomicLong ids=new AtomicLong(3);
 public BranchController(){branches.put(1L,new Branch(1L,"BKK","สาขาสุขุมวิท (Sukhumvit)","02-105-4421","123 ถนนสุขุมวิท แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110",true));branches.put(2L,new Branch(2L,"SAL","สาขาศาลายา (Salaya)","02-441-0987","99 ถนนศาลายา-นครชัยศรี อ.พุทธมณฑล จ.นครปฐม 73170",true));branches.put(3L,new Branch(3L,"CNX","สาขาเชียงใหม่ (Chiang Mai)","053-224-556","45 ถนนนิมมานเหมินท์ ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200",true));}
 @GetMapping public List<Branch> list(){return branches.values().stream().sorted((a,b)->Long.compare(a.id(),b.id())).toList();}
 @PostMapping @ResponseStatus(HttpStatus.CREATED) public Branch create(@Valid @RequestBody BranchRequest r){long id=ids.incrementAndGet();Branch b=new Branch(id,r.code(),r.name(),r.phone(),r.address(),r.active());branches.put(id,b);return b;}
 @PatchMapping("/{id}/status") public Branch updateStatus(@PathVariable long id,@RequestBody StatusRequest r){Branch updated=branches.computeIfPresent(id,(k,v)->v.withActive(r.active()));if(updated==null)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Branch not found");return updated;}
 public record StatusRequest(boolean active){}
}
