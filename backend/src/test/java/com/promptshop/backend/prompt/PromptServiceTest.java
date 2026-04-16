package com.promptshop.backend.prompt;

import com.promptshop.backend.common.NotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PromptServiceTest {

    @Mock
    private PromptRepository promptRepository;

    @InjectMocks
    private PromptService promptService;

    @Test
    void listPublicPromptsReturnsMappedResponses() {
        Prompt prompt = prompt(1L, "Title", true);
        when(promptRepository.findByPublishedTrueOrderByCreatedAtDesc()).thenReturn(List.of(prompt));

        List<PromptResponse> responses = promptService.listPublicPrompts();

        assertEquals(1, responses.size());
        assertEquals(1L, responses.getFirst().id());
        assertEquals("Title", responses.getFirst().title());
        assertTrue(responses.getFirst().published());
    }

    @Test
    void getPublicPromptReturnsMappedResponse() {
        Prompt prompt = prompt(3L, "Prompt 3", true);
        when(promptRepository.findByIdAndPublishedTrue(3L)).thenReturn(Optional.of(prompt));

        PromptResponse response = promptService.getPublicPrompt(3L);

        assertEquals(3L, response.id());
        assertEquals("Prompt 3", response.title());
    }

    @Test
    void getPublicPromptThrowsWhenNotFound() {
        when(promptRepository.findByIdAndPublishedTrue(404L)).thenReturn(Optional.empty());

        NotFoundException exception = assertThrows(NotFoundException.class, () -> promptService.getPublicPrompt(404L));

        assertEquals("Prompt not found", exception.getMessage());
    }

    @Test
    void createPromptTrimsFieldsAndSaves() {
        PromptRequest request = new PromptRequest(
                "  New title  ",
                "  Short description  ",
                "  Content text  ",
                new BigDecimal("19.99"),
                "  Marketing  ",
                "  email,copywriting  ",
                "  https://img.test/p.png  ",
                true
        );
        when(promptRepository.save(any(Prompt.class))).thenAnswer(invocation -> {
            Prompt saved = invocation.getArgument(0);
            saved.setId(9L);
            return saved;
        });

        PromptResponse response = promptService.createPrompt(request);

        assertEquals(9L, response.id());
        assertEquals("New title", response.title());
        assertEquals("Short description", response.shortDescription());
        assertEquals("Content text", response.contentText());
        assertEquals("Marketing", response.category());
        assertEquals("email,copywriting", response.tags());
        assertEquals("https://img.test/p.png", response.imageUrl());
        assertTrue(response.published());
    }

    @Test
    void updatePromptUpdatesExistingPrompt() {
        Prompt existing = prompt(5L, "Old title", false);
        when(promptRepository.findById(5L)).thenReturn(Optional.of(existing));
        when(promptRepository.save(existing)).thenReturn(existing);

        PromptRequest request = new PromptRequest(
                "  Updated title  ",
                "  Updated short description  ",
                "  Updated content  ",
                new BigDecimal("29.99"),
                "  Productivity  ",
                "  focus,time  ",
                "  https://img.test/new.png  ",
                true
        );

        PromptResponse response = promptService.updatePrompt(5L, request);

        assertEquals("Updated title", response.title());
        assertEquals("Updated short description", response.shortDescription());
        assertEquals("Updated content", response.contentText());
        assertEquals(new BigDecimal("29.99"), response.priceUsd());
        assertEquals("Productivity", response.category());
        assertEquals("focus,time", response.tags());
        assertEquals("https://img.test/new.png", response.imageUrl());
        assertTrue(response.published());
    }

    @Test
    void deletePromptDeletesPromptWhenFound() {
        Prompt existing = prompt(8L, "Delete me", true);
        when(promptRepository.findById(8L)).thenReturn(Optional.of(existing));

        promptService.deletePrompt(8L);

        verify(promptRepository, times(1)).delete(existing);
    }

    @Test
    void getPublishedPromptsByIdsPreservesRequestedOrder() {
        Prompt first = prompt(1L, "First", true);
        Prompt second = prompt(2L, "Second", true);
        when(promptRepository.findByIdInAndPublishedTrue(List.of(2L, 1L))).thenReturn(List.of(first, second));

        List<Prompt> result = promptService.getPublishedPromptsByIds(List.of(2L, 1L));

        assertEquals(2, result.size());
        assertEquals(2L, result.getFirst().getId());
        assertEquals(1L, result.get(1).getId());
    }

    @Test
    void getPublishedPromptsByIdsThrowsWhenAnyPromptMissing() {
        Prompt only = prompt(1L, "Only one", true);
        when(promptRepository.findByIdInAndPublishedTrue(List.of(1L, 2L))).thenReturn(List.of(only));

        NotFoundException exception = assertThrows(
                NotFoundException.class,
                () -> promptService.getPublishedPromptsByIds(List.of(1L, 2L))
        );

        assertEquals("One or more selected prompts do not exist", exception.getMessage());
    }

    @Test
    void totalPromptsReturnsRepositoryCount() {
        when(promptRepository.count()).thenReturn(42L);

        long total = promptService.totalPrompts();

        assertEquals(42L, total);
    }

    @Test
    void createPromptPassesTrimmedEntityToRepository() {
        PromptRequest request = new PromptRequest(
                "  A  ", "  B  ", "  C  ", new BigDecimal("1.00"),
                "  D  ", "  E  ", "  F  ", false
        );
        when(promptRepository.save(any(Prompt.class))).thenAnswer(invocation -> invocation.getArgument(0));

        promptService.createPrompt(request);

        ArgumentCaptor<Prompt> captor = ArgumentCaptor.forClass(Prompt.class);
        verify(promptRepository).save(captor.capture());
        Prompt saved = captor.getValue();
        assertEquals("A", saved.getTitle());
        assertEquals("B", saved.getShortDescription());
        assertEquals("C", saved.getContentText());
        assertEquals("D", saved.getCategory());
        assertEquals("E", saved.getTags());
        assertEquals("F", saved.getImageUrl());
        assertFalse(saved.isPublished());
    }

    private Prompt prompt(Long id, String title, boolean published) {
        Prompt prompt = new Prompt();
        prompt.setId(id);
        prompt.setTitle(title);
        prompt.setShortDescription("Short " + title);
        prompt.setContentText("Content " + title);
        prompt.setPriceUsd(new BigDecimal("9.99"));
        prompt.setCategory("General");
        prompt.setTags("tag1,tag2");
        prompt.setImageUrl("https://img.test/" + id);
        prompt.setPublished(published);
        return prompt;
    }
}
