
package com.spendsense.backend.repository;

import com.spendsense.backend.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TransactionRepository
        extends JpaRepository<Transaction, Long> {

    List<Transaction> findAllByUser_EmailOrderByDateDesc(String email);

    Optional<Transaction> findByIdAndUser_Email(Long id, String email);
}
