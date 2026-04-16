package com.promptshop.backend.prompt;

import com.promptshop.backend.common.NotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PromptServiceTest {

    @Mock
    private PromptRepository promptRepository;

    @InjectMocks
    private PromptService promptService;

    @Test
    void listPublicPrompts_returnsPublishedPrompts() {
        Prompt prompt = samplePrompt(1L, "Public prompt", true);
        when(promptRepository.findByPublishedTrueOrderByCreatedAtDesc()).thenReturn(List.of(prompt));

        List<PromptResponse> result = promptService.listPublicPrompts();

        assertEquals(1, result.size());
        assertEquals("Public prompt", result.get(0).title());
        assertTrue(result.get(0).published());
    }

    @Test
    void getPublicPrompt_returnsPromptById() {
        Prompt prompt = samplePrompt(2L, "Prompt #2", true);
        when(promptRepository.findByIdAndPublishedTrue(2L)).thenReturn(Optional.of(prompt));

        PromptResponse result = promptService.getPublicPrompt(2L);

        assertEquals(2L, result.id());
        assertEquals("Prompt #2", result.title());
    }

    @Test
    void getPublicPrompt_throwsWhenPromptMissing() {
        when(promptRepository.findByIdAndPublishedTrue(99L)).thenReturn(Optional.empty());

        NotFoundException error = assertThrows(NotFoundException.class, () -> promptService.getPublicPrompt(99L));

        assertEquals("Prompt not found", error.getMessage());
    }

    @Test
    void listAllPrompts_returnsAllPrompts() {
        Prompt first = samplePrompt(1L, "First", false);
        Prompt second = samplePrompt(2L, "Second", true);
        when(promptRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt")))
                .thenReturn(List.of(second, first));

        List<PromptResponse> result = promptService.listAllPrompts();

        assertEquals(2, result.size());
        assertEquals("Second", result.get(0).title());
        assertEquals("First", result.get(1).title());
    }

    @Test
    void createPrompt_savesTrimmedFields() {
        PromptRequest request = new PromptRequest(
                "  New title ",
                " short description  ",
                " content text  ",
                new BigDecimal("10.00"),
                " marketing  ",
                " tag1,tag2  ",
                " https://img/p.png  ",
                true
        );
        when(promptRepository.save(any(Prompt.class))).thenAnswer(invocation -> {
            Prompt saved = invocation.getArgument(0);
            saved.setId(7L);
            return saved;
        });

        PromptResponse result = promptService.createPrompt(request);

        assertEquals(7L, result.id());
        assertEquals("New title", result.title());
        assertEquals("short description", result.shortDescription());
        assertEquals("content text", result.contentText());
        assertEquals("marketing", result.category());
        assertEquals("tag1,tag2", result.tags());
        assertEquals("https://img/p.png", result.imageUrl());
        assertTrue(result.published());
    }

    @Test
    void updatePrompt_updatesPromptFields() {
        Prompt existing = samplePrompt(3L, "Old title", false);
        when(promptRepository.findById(3L)).thenReturn(Optional.of(existing));
        when(promptRepository.save(existing)).thenReturn(existing);

        PromptRequest request = new PromptRequest(
                " Updated title ",
                " updated short ",
                " updated content ",
                new BigDecimal("20.00"),
                " productivity ",
                " focus,time ",
                " https://img/new.png ",
                true
        );

        PromptResponse result = promptService.updatePrompt(3L, request);

        assertEquals("Updated title", result.title());
        assertEquals("updated short", result.shortDescription());
        assertEquals("updated content", result.contentText());
        assertEquals(new BigDecimal("20.00"), result.priceUsd());
        assertEquals("productivity", result.category());
        assertEquals("focus,time", result.tags());
        assertEquals("https://img/new.png", result.imageUrl());
        assertTrue(result.published());
    }

    @Test
    void deletePrompt_deletesPromptWhenFound() {
        Prompt existing = samplePrompt(4L, "To delete", true);
        when(promptRepository.findById(4L)).thenReturn(Optional.of(existing));

        promptService.deletePrompt(4L);

        verify(promptRepository).delete(existing);
    }

    @Test
    void getPublishedPromptsByIds_returnsPromptsInRequestedOrder() {
        Prompt one = samplePrompt(1L, "One", true);
        Prompt two = samplePrompt(2L, "Two", true);
        when(promptRepository.findByIdInAndPublishedTrue(List.of(2L, 1L))).thenReturn(List.of(one, two));

        List<Prompt> result = promptService.getPublishedPromptsByIds(List.of(2L, 1L));

        assertEquals(2L, result.get(0).getId());
        assertEquals(1L, result.get(1).getId());
    }

    @Test
    void getPublishedPromptsByIds_throwsWhenMissingPrompt() {
        Prompt one = samplePrompt(1L, "One", true);
        when(promptRepository.findByIdInAndPublishedTrue(List.of(1L, 2L))).thenReturn(List.of(one));

        NotFoundException error = assertThrows(
                NotFoundException.class,
                () -> promptService.getPublishedPromptsByIds(List.of(1L, 2L))
        );

        assertEquals("One or more selected prompts do not exist", error.getMessage());
    }

    @Test
    void totalPrompts_returnsRepositoryCount() {
        when(promptRepository.count()).thenReturn(15L);

        long count = promptService.totalPrompts();

        assertEquals(15L, count);
    }

    @Test
    void deletePrompt_throwsWhenPromptMissing() {
        when(promptRepository.findById(404L)).thenReturn(Optional.empty());

        NotFoundException error = assertThrows(NotFoundException.class, () -> promptService.deletePrompt(404L));

        assertEquals("Prompt not found", error.getMessage());
    }

    private Prompt samplePrompt(Long id, String title, boolean published) {
        Prompt prompt = new Prompt();
        prompt.setId(id);
        prompt.setTitle(title);
        prompt.setShortDescription("Short " + title);
        prompt.setContentText("Content " + title);
        prompt.setPriceUsd(new BigDecimal("9.99"));
        prompt.setCategory("General");
        prompt.setTags("tag1,tag2");
        prompt.setImageUrl("https://img/" + id);
        prompt.setPublished(published);
        return prompt;
    }
}
