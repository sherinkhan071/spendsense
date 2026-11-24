
package com.spendsense.backend.controller;

import com.spendsense.backend.entity.AppUser;
import com.spendsense.backend.entity.Transaction;
import com.spendsense.backend.repository.AppUserRepository;
import com.spendsense.backend.repository.TransactionRepository;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    private final TransactionRepository transactionRepository;
    private final AppUserRepository userRepository;

    public TransactionController(
            TransactionRepository transactionRepository,
            AppUserRepository userRepository) {
        this.transactionRepository = transactionRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<Transaction> getAllTransactions(Authentication authentication) {
        return transactionRepository
                .findAllByUser_EmailOrderByDateDesc(authentication.getName());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getTransaction(
            @PathVariable Long id,
            Authentication authentication) {

        return transactionRepository
                .findByIdAndUser_Email(id, authentication.getName())
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createTransaction(
            @Valid @RequestBody Transaction transaction,
            Authentication authentication) {

        if (!isValidType(transaction.getType())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Type must be INCOME or EXPENSE."));
        }

        AppUser user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalStateException(
                        "Authenticated user no longer exists."));

        transaction.setId(null);
        transaction.setUser(user);

        Transaction saved = transactionRepository.save(transaction);

        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateTransaction(
            @PathVariable Long id,
            @Valid @RequestBody Transaction updatedTransaction,
            Authentication authentication) {

        if (!isValidType(updatedTransaction.getType())) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Type must be INCOME or EXPENSE."));
        }

        return transactionRepository
                .findByIdAndUser_Email(id, authentication.getName())
                .<ResponseEntity<?>>map(existing -> {
                    existing.setTitle(updatedTransaction.getTitle());
                    existing.setAmount(updatedTransaction.getAmount());
                    existing.setCategory(updatedTransaction.getCategory());
                    existing.setType(updatedTransaction.getType());
                    existing.setDate(updatedTransaction.getDate());

                    return ResponseEntity.ok(
                            transactionRepository.save(existing));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTransaction(
            @PathVariable Long id,
            Authentication authentication) {

        return transactionRepository
                .findByIdAndUser_Email(id, authentication.getName())
                .<ResponseEntity<?>>map(transaction -> {
                    transactionRepository.delete(transaction);
                    return ResponseEntity.noContent().build();
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private boolean isValidType(String type) {
        return type != null
                && (type.equals("INCOME") || type.equals("EXPENSE"));
    }
}
