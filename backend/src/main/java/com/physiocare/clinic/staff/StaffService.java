package com.physiocare.clinic.staff;
import com.physiocare.clinic.auth.*;
import jakarta.transaction.Transactional;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;
@Service public class StaffService {
    private final StaffRepository staff; private final AppUserRepository users; private final RoleRepository roles; private final PasswordEncoder encoder;
    public StaffService(StaffRepository s,AppUserRepository u,RoleRepository r,PasswordEncoder e){staff=s;users=u;roles=r;encoder=e;}
    @Transactional public StaffDtos.CreateResponse create(StaffDtos.CreateRequest r){
        String email=r.email().trim().toLowerCase();
        if(users.existsByEmailIgnoreCase(email)) throw new ResponseStatusException(HttpStatus.CONFLICT,"Email is already in use");
        String code=r.role().equals("PHYSIOTHERAPIST")?"PHYSIO":r.role();
        Role role=roles.findByCode(code).orElseThrow(()->new ResponseStatusException(HttpStatus.BAD_REQUEST,"Role not found"));
        AppUser user=new AppUser(); user.setEmail(email); user.setPasswordHash(encoder.encode(r.password())); user.setFirstName(r.name().trim()); user.setLastName(r.nameEn()==null||r.nameEn().isBlank()?"Staff":r.nameEn().trim()); user.setActive(true); user.setRoles(Set.of(role)); users.save(user);
        Staff p=new Staff(); p.setName(r.name().trim()); p.setNameEn(r.nameEn()==null?"":r.nameEn().trim()); p.setPosition(r.position().trim()); p.setPhone(r.phone()==null?"":r.phone().trim()); p.setEmail(email); p.setBranchIds(r.branchIds()); p.setStatus("ACTIVE"); p.setAvatarColor(r.avatarColor()==null?"bg-[#1A4A2E]":r.avatarColor()); p.setUserId(user.getId()); Staff saved=staff.save(p);
        return new StaffDtos.CreateResponse(saved.getId(),user.getId());
    }

    public List<StaffDtos.Row> listActive() {
        return staff.findAllByDeletedAtIsNullOrderByIdAsc().stream().map(person -> {
            AppUser user = users.findById(person.getUserId()).orElse(null);
            String role = user == null ? null : user.getRoles().stream().map(Role::getCode).findFirst().orElse(null);
            return new StaffDtos.Row(person.getId(), person.getName(), person.getNameEn(), person.getPosition(), person.getPhone(),
                    person.getEmail(), person.getBranchIds(), person.getStatus(), person.getAvatarColor(), person.getUserId(), role,
                    user != null && user.isActive());
        }).collect(Collectors.toList());
    }

    @Transactional
    public void softDeleteByEmail(String email) {
        Staff person = staff.findFirstByEmailIgnoreCaseAndDeletedAtIsNull(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff not found"));
        OffsetDateTime now = OffsetDateTime.now();
        person.setDeletedAt(now);
        AppUser user = users.findByEmailIgnoreCase(email).orElse(null);
        if (user != null) {
            user.setActive(false);
            user.setDeletedAt(now);
            users.save(user);
        }
        staff.save(person);
    }
}
