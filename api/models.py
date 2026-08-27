from django.db import models

class AppUser(models.Model):
    email = models.EmailField(unique=True)
    mobile = models.CharField(max_length=50, blank=True, default='')
    name = models.CharField(max_length=255, blank=True, default='')
    location = models.CharField(max_length=255, blank=True, default='')
    sessions = models.IntegerField(default=5)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'users'

    def __str__(self):
        return f"{self.email} ({self.sessions} sessions)"
